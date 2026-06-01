package com.somaticbuilding.aiassistant.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RagKnowledgeService {
  private static final Logger log = LoggerFactory.getLogger(RagKnowledgeService.class);
  private static final Pattern TOKEN_PATTERN = Pattern.compile("[\\p{L}\\p{N}]{2,}");
  private static final Pattern CJK_PATTERN = Pattern.compile("[\\u4e00-\\u9fff]");
  private static final int CHUNK_LENGTH = 850;
  private static final int CHUNK_OVERLAP = 130;

  private final boolean enabled;
  private final String classpathPattern;
  private final String externalDir;
  private final int defaultTopK;

  private volatile List<RagChunk> chunks = List.of();
  private volatile LocalDateTime loadedAt;

  public RagKnowledgeService(
    @Value("${somatic.rag.enabled:true}") boolean enabled,
    @Value("${somatic.rag.classpath-pattern:classpath*:rag-kb/*.md}") String classpathPattern,
    @Value("${somatic.rag.external-dir:./knowledge-base}") String externalDir,
    @Value("${somatic.rag.top-k:4}") int defaultTopK
  ) {
    this.enabled = enabled;
    this.classpathPattern = classpathPattern;
    this.externalDir = externalDir;
    this.defaultTopK = Math.max(1, defaultTopK);
  }

  @PostConstruct
  public void init() {
    reload();
  }

  public void reload() {
    if (!enabled) {
      this.chunks = List.of();
      this.loadedAt = LocalDateTime.now();
      log.info("RAG is disabled by configuration.");
      return;
    }

    List<RagChunk> loaded = new ArrayList<>();
    loaded.addAll(loadClasspathChunks());
    loaded.addAll(loadExternalChunks());
    this.chunks = List.copyOf(loaded);
    this.loadedAt = LocalDateTime.now();
    log.info("RAG knowledge loaded. chunks={}, loadedAt={}", this.chunks.size(), this.loadedAt);
  }

  public boolean isReady() {
    return enabled && !chunks.isEmpty();
  }

  public int getDefaultTopK() {
    return defaultTopK;
  }

  public List<RagMatch> search(String query, int topK) {
    if (!isReady() || !StringUtils.hasText(query)) {
      return List.of();
    }
    Set<String> queryTokens = tokenize(query);
    if (queryTokens.isEmpty()) {
      return List.of();
    }

    int k = Math.max(1, topK);
    List<RagMatch> scored = new ArrayList<>();
    for (RagChunk chunk : chunks) {
      double score = score(query, queryTokens, chunk);
      if (score <= 0.0d) continue;
      scored.add(new RagMatch(chunk.source, chunk.chunkId, chunk.content, score));
    }
    scored.sort(Comparator.comparingDouble(RagMatch::score).reversed());
    if (scored.size() > k) {
      return List.copyOf(scored.subList(0, k));
    }
    return List.copyOf(scored);
  }

  public String renderPromptContext(List<RagMatch> matches) {
    if (matches == null || matches.isEmpty()) {
      return "";
    }
    StringBuilder builder = new StringBuilder();
    int index = 1;
    for (RagMatch item : matches) {
      if (item == null || !StringUtils.hasText(item.content)) continue;
      builder
        .append("[R")
        .append(index)
        .append("] source=")
        .append(item.source)
        .append(" chunk=")
        .append(item.chunkId)
        .append('\n')
        .append(item.content.trim())
        .append("\n\n");
      index += 1;
    }
    return builder.toString().trim();
  }

  public String renderFallbackAnswer(String question, boolean chinese, List<RagMatch> matches) {
    if (matches == null || matches.isEmpty()) {
      return chinese
        ? "当前知识库没有命中可用参考资料。请补充更具体的问题或导入资料。"
        : "No matching reference was found in the current knowledge base. Please refine your question or add resources.";
    }

    StringBuilder builder = new StringBuilder();
    if (chinese) {
      builder.append("基于知识库参考，我先给你一个简要建议：\n");
      for (int i = 0; i < matches.size(); i += 1) {
        RagMatch item = matches.get(i);
        builder
          .append(i + 1)
          .append(". ")
          .append(extractFirstSentence(item.content, true))
          .append(" [")
          .append(item.source)
          .append("#")
          .append(item.chunkId)
          .append("]\n");
      }
      builder.append("\n如果你希望，我可以按你的目标把建议整理成可执行训练安排。");
      return builder.toString().trim();
    }

    builder.append("Here is a concise answer from the local knowledge base:\n");
    for (int i = 0; i < matches.size(); i += 1) {
      RagMatch item = matches.get(i);
      builder
        .append(i + 1)
        .append(". ")
        .append(extractFirstSentence(item.content, false))
        .append(" [")
        .append(item.source)
        .append("#")
        .append(item.chunkId)
        .append("]\n");
    }
    builder.append("\nIf you want, I can convert this into a concrete workout structure.");
    return builder.toString().trim();
  }

  private List<RagChunk> loadClasspathChunks() {
    if (!StringUtils.hasText(classpathPattern)) return List.of();
    List<RagChunk> loaded = new ArrayList<>();
    try {
      Resource[] resources = new PathMatchingResourcePatternResolver().getResources(classpathPattern);
      int chunkCounter = 1;
      for (Resource resource : resources) {
        if (resource == null || !resource.exists() || !resource.isReadable()) continue;
        String name = resource.getFilename();
        if (!StringUtils.hasText(name)) {
          name = "classpath-doc";
        }
        String text = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        List<String> pieces = splitIntoChunks(cleanText(text));
        for (String piece : pieces) {
          loaded.add(buildChunk(name, chunkCounter, piece));
          chunkCounter += 1;
        }
      }
    } catch (IOException ex) {
      log.warn("Failed to load classpath RAG resources: {}", ex.getMessage());
    }
    return loaded;
  }

  private List<RagChunk> loadExternalChunks() {
    if (!StringUtils.hasText(externalDir)) return List.of();
    Path root = Paths.get(externalDir).toAbsolutePath().normalize();
    if (!Files.exists(root) || !Files.isDirectory(root)) {
      return List.of();
    }

    List<RagChunk> loaded = new ArrayList<>();
    int chunkCounter = 100000;
    try (var stream = Files.walk(root, 3)) {
      List<Path> files =
        stream
          .filter(Files::isRegularFile)
          .filter(path -> {
            String fileName = path.getFileName().toString().toLowerCase(Locale.ROOT);
            return fileName.endsWith(".md") || fileName.endsWith(".txt");
          })
          .toList();
      for (Path file : files) {
        String text = Files.readString(file, StandardCharsets.UTF_8);
        String source = root.relativize(file).toString().replace('\\', '/');
        List<String> pieces = splitIntoChunks(cleanText(text));
        for (String piece : pieces) {
          loaded.add(buildChunk(source, chunkCounter, piece));
          chunkCounter += 1;
        }
      }
    } catch (IOException ex) {
      log.warn("Failed to load external RAG resources from {}: {}", root, ex.getMessage());
    }
    return loaded;
  }

  private RagChunk buildChunk(String source, int chunkId, String content) {
    Set<String> tokens = tokenize(content);
    return new RagChunk(source, chunkId, content, tokens);
  }

  private String cleanText(String raw) {
    if (!StringUtils.hasText(raw)) return "";
    return raw.replace("\r", "").trim();
  }

  private List<String> splitIntoChunks(String text) {
    if (!StringUtils.hasText(text)) return List.of();
    List<String> chunks = new ArrayList<>();
    int length = text.length();
    int start = 0;
    while (start < length) {
      int end = Math.min(length, start + CHUNK_LENGTH);
      String piece = text.substring(start, end).trim();
      if (!piece.isEmpty()) {
        chunks.add(piece);
      }
      if (end >= length) break;
      start = Math.max(start + 1, end - CHUNK_OVERLAP);
    }
    return chunks;
  }

  private Set<String> tokenize(String text) {
    if (!StringUtils.hasText(text)) {
      return Collections.emptySet();
    }
    String normalized = text.toLowerCase(Locale.ROOT);
    Set<String> tokens = new LinkedHashSet<>();
    Matcher matcher = TOKEN_PATTERN.matcher(normalized);
    while (matcher.find()) {
      String token = matcher.group();
      if (token.length() >= 2) {
        tokens.add(token);
      }
    }
    appendCjkTokens(normalized, tokens);
    return tokens;
  }

  private void appendCjkTokens(String text, Set<String> tokens) {
    if (!CJK_PATTERN.matcher(text).find()) return;
    StringBuilder onlyCjk = new StringBuilder();
    for (int i = 0; i < text.length(); i += 1) {
      char ch = text.charAt(i);
      if (isCjk(ch)) {
        onlyCjk.append(ch);
      } else {
        onlyCjk.append(' ');
      }
    }
    String[] segments = onlyCjk.toString().split("\\s+");
    for (String segment : segments) {
      if (segment.length() < 2) continue;
      for (int i = 0; i < segment.length(); i += 1) {
        tokens.add(String.valueOf(segment.charAt(i)));
      }
      for (int i = 0; i < segment.length() - 1; i += 1) {
        tokens.add(segment.substring(i, i + 2));
      }
    }
  }

  private boolean isCjk(char ch) {
    return ch >= 0x4e00 && ch <= 0x9fff;
  }

  private double score(String query, Set<String> queryTokens, RagChunk chunk) {
    if (queryTokens.isEmpty() || chunk.tokens.isEmpty()) return 0d;
    int overlap = 0;
    for (String token : queryTokens) {
      if (chunk.tokens.contains(token)) {
        overlap += 1;
      }
    }
    if (overlap == 0) return 0d;

    double tokenScore = overlap / Math.sqrt((double) queryTokens.size() * (double) chunk.tokens.size());
    double phraseBonus = 0d;
    String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
    if (q.length() >= 4 && chunk.content.toLowerCase(Locale.ROOT).contains(q)) {
      phraseBonus = 0.18d;
    }
    return tokenScore + phraseBonus;
  }

  private String extractFirstSentence(String text, boolean chinese) {
    if (!StringUtils.hasText(text)) return "";
    String normalized = text.replace('\n', ' ').trim();
    if (normalized.length() <= 140) return normalized;
    if (chinese) {
      int stop = normalized.indexOf('。');
      if (stop > 0 && stop < 140) {
        return normalized.substring(0, stop + 1);
      }
      return normalized.substring(0, 140) + "...";
    }
    int stop = normalized.indexOf('.');
    if (stop > 0 && stop < 140) {
      return normalized.substring(0, stop + 1);
    }
    return normalized.substring(0, 140) + "...";
  }

  private static final class RagChunk {
    final String source;
    final int chunkId;
    final String content;
    final Set<String> tokens;

    private RagChunk(String source, int chunkId, String content, Set<String> tokens) {
      this.source = source;
      this.chunkId = chunkId;
      this.content = content;
      this.tokens = new HashSet<>(tokens);
    }
  }

  public record RagMatch(
    String source,
    int chunkId,
    String content,
    double score
  ) {}
}
