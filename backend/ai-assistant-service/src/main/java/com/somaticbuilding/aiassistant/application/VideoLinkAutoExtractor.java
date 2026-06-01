package com.somaticbuilding.aiassistant.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class VideoLinkAutoExtractor {
  private static final Pattern META_TAG_PATTERN = Pattern.compile(
    "<meta\\s+[^>]*(?:property|name)\\s*=\\s*[\"']([^\"']+)[\"'][^>]*content\\s*=\\s*[\"']([^\"']+)[\"'][^>]*>",
    Pattern.CASE_INSENSITIVE
  );
  private static final Pattern TITLE_TAG_PATTERN = Pattern.compile(
    "<title[^>]*>(.*?)</title>",
    Pattern.CASE_INSENSITIVE | Pattern.DOTALL
  );
  private static final Pattern SRT_TIME_PATTERN = Pattern.compile(
    "^\\d{1,2}:\\d{2}:\\d{2},\\d{3}\\s+-->\\s+\\d{1,2}:\\d{2}:\\d{2},\\d{3}$"
  );
  private static final Pattern VTT_TIME_PATTERN = Pattern.compile(
    "^\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?\\s+-->\\s+\\d{1,2}:\\d{2}:\\d{2}(?:\\.\\d{3})?$"
  );
  private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]+>");

  private final ObjectMapper objectMapper;
  private final HttpClient httpClient;
  private final boolean enabled;
  private final String ytDlpCommand;
  private final int ytDlpTimeoutSeconds;
  private final int ytDlpAudioTimeoutSeconds;
  private final String ffmpegCommand;
  private final boolean asrEnabled;
  private final String asrMode;
  private final String asrCommand;
  private final String asrModel;
  private final String asrLanguage;
  private final int asrTimeoutSeconds;
  private final String asrDockerCommand;
  private final String asrDockerImage;
  private final boolean asrDockerPullMissing;
  private final int maxTextChars;
  private final String userAgent;
  private final String cookiesFromBrowser;
  private final String cookiesFile;
  private final String referer;

  public VideoLinkAutoExtractor(
    ObjectProvider<ObjectMapper> objectMapperProvider,
    @Value("${integration.content-extractor.enabled:true}") boolean enabled,
    @Value("${integration.content-extractor.yt-dlp.command:yt-dlp}") String ytDlpCommand,
    @Value("${integration.content-extractor.yt-dlp.cookies-from-browser:}") String cookiesFromBrowser,
    @Value("${integration.content-extractor.yt-dlp.cookies-file:}") String cookiesFile,
    @Value("${integration.content-extractor.yt-dlp.referer:}") String referer,
    @Value("${integration.content-extractor.yt-dlp.timeout-seconds:35}") int ytDlpTimeoutSeconds,
    @Value("${integration.content-extractor.yt-dlp.audio-timeout-seconds:120}") int ytDlpAudioTimeoutSeconds,
    @Value("${integration.content-extractor.ffmpeg.command:ffmpeg}") String ffmpegCommand,
    @Value("${integration.content-extractor.asr.enabled:false}") boolean asrEnabled,
    @Value("${integration.content-extractor.asr.mode:local}") String asrMode,
    @Value("${integration.content-extractor.asr.command:whisper}") String asrCommand,
    @Value("${integration.content-extractor.asr.model:small}") String asrModel,
    @Value("${integration.content-extractor.asr.language:zh}") String asrLanguage,
    @Value("${integration.content-extractor.asr.timeout-seconds:300}") int asrTimeoutSeconds,
    @Value("${integration.content-extractor.asr.docker.command:docker}") String asrDockerCommand,
    @Value("${integration.content-extractor.asr.docker.image:witblack/whisper:tiny}") String asrDockerImage,
    @Value("${integration.content-extractor.asr.docker.pull-missing:true}") boolean asrDockerPullMissing,
    @Value("${integration.content-extractor.max-text-chars:12000}") int maxTextChars,
    @Value("${integration.content-extractor.user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36}") String userAgent
  ) {
    this.objectMapper = objectMapperProvider.getIfAvailable(ObjectMapper::new);
    this.httpClient = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(8))
      .followRedirects(HttpClient.Redirect.NORMAL)
      .build();
    this.enabled = enabled;
    this.ytDlpCommand = normalizeString(ytDlpCommand);
    this.ytDlpTimeoutSeconds = Math.max(10, ytDlpTimeoutSeconds);
    this.ytDlpAudioTimeoutSeconds = Math.max(30, ytDlpAudioTimeoutSeconds);
    this.ffmpegCommand = normalizeString(ffmpegCommand);
    this.asrEnabled = asrEnabled;
    this.asrMode = normalizeString(asrMode).toLowerCase(Locale.ROOT);
    this.asrCommand = normalizeString(asrCommand);
    this.asrModel = normalizeString(asrModel);
    this.asrLanguage = normalizeString(asrLanguage);
    this.asrTimeoutSeconds = Math.max(30, asrTimeoutSeconds);
    this.asrDockerCommand = normalizeString(asrDockerCommand);
    this.asrDockerImage = normalizeString(asrDockerImage);
    this.asrDockerPullMissing = asrDockerPullMissing;
    this.maxTextChars = Math.max(2000, maxTextChars);
    this.userAgent = normalizeString(userAgent);
    this.cookiesFromBrowser = normalizeString(cookiesFromBrowser);
    this.cookiesFile = normalizeString(cookiesFile);
    this.referer = normalizeString(referer);
  }

  public ExtractionResult extract(String sourceUrl) {
    String normalizedUrl = normalizeString(sourceUrl);
    if (!enabled || normalizedUrl.isEmpty()) {
      return ExtractionResult.empty();
    }

    ExtractionResult result = new ExtractionResult();
    result.setSourceUrl(normalizedUrl);

    try {
      ExtractedMetadata metadata = extractMetadataWithYtDlp(normalizedUrl);
      result.setTitle(metadata.title);
      result.setDescription(metadata.description);
      result.setUploader(metadata.uploader);
      result.setDurationSec(metadata.durationSec);
      result.setTags(metadata.tags);
      if (!metadata.rawMeta.isEmpty()) {
        result.getMetadata().putAll(metadata.rawMeta);
      }
      if (!metadata.extractionErrors.isEmpty()) {
        result.getWarnings().addAll(metadata.extractionErrors);
      }
    } catch (Exception ex) {
      result.getWarnings().add("yt_dlp_metadata_failed:" + ex.getMessage());
    }

    try {
      String subtitle = extractSubtitleWithYtDlp(normalizedUrl);
      if (!subtitle.isBlank()) {
        result.setSubtitleText(truncate(subtitle, maxTextChars));
      }
    } catch (Exception ex) {
      result.getWarnings().add("yt_dlp_subtitle_failed:" + ex.getMessage());
    }

    if (result.getSubtitleText().isBlank() && asrEnabled) {
      try {
        String asrText = extractSubtitleWithAsrFallback(normalizedUrl);
        if (!asrText.isBlank()) {
          result.setSubtitleText(truncate(asrText, maxTextChars));
          result.getMetadata().put("subtitle_source", "asr_fallback");
        }
      } catch (Exception ex) {
        result.getWarnings().add("asr_fallback_failed:" + ex.getMessage());
      }
    }

    if (result.getTitle().isBlank() || result.getDescription().isBlank()) {
      try {
        ExtractedMetadata htmlMeta = extractMetadataFromHtml(normalizedUrl);
        if (result.getTitle().isBlank()) {
          result.setTitle(htmlMeta.title);
        }
        if (result.getDescription().isBlank()) {
          result.setDescription(htmlMeta.description);
        }
        if (result.getUploader().isBlank()) {
          result.setUploader(htmlMeta.uploader);
        }
      } catch (Exception ex) {
        result.getWarnings().add("html_metadata_failed:" + ex.getMessage());
      }
    }

    String normalizedSummary = buildNormalizedSummary(result);
    if (!normalizedSummary.isBlank()) {
      result.setSummaryText(truncate(normalizedSummary, maxTextChars));
    }

    return result;
  }

  private ExtractedMetadata extractMetadataWithYtDlp(String sourceUrl) throws IOException, InterruptedException {
    if (ytDlpCommand.isEmpty()) {
      throw new IllegalStateException("yt-dlp command is empty.");
    }
    List<String> command = new ArrayList<>();
    command.add(ytDlpCommand);
    command.add("--skip-download");
    command.add("--no-playlist");
    command.add("--no-warnings");
    command.add("--dump-single-json");
    appendYtDlpCommonOptions(command);
    command.add(sourceUrl);

    CommandResult commandResult = runCommand(command, null);
    if (!commandResult.success) {
      throw new IllegalStateException(commandResult.output);
    }

    JsonNode root = objectMapper.readTree(commandResult.output);
    ExtractedMetadata metadata = new ExtractedMetadata();
    metadata.title = readText(root, "fulltitle", "title");
    metadata.description = readText(root, "description");
    metadata.uploader = readText(root, "uploader", "channel");
    metadata.durationSec = root.path("duration").isNumber() ? root.path("duration").asInt() : 0;

    List<String> tags = new ArrayList<>();
    JsonNode tagsNode = root.path("tags");
    if (tagsNode.isArray()) {
      for (JsonNode node : tagsNode) {
        if (node.isTextual()) {
          String value = normalizeString(node.asText(""));
          if (!value.isEmpty()) {
            tags.add(value);
          }
        }
      }
    }
    metadata.tags = tags;

    Map<String, Object> raw = new LinkedHashMap<>();
    raw.put("extractor", readText(root, "extractor", "extractor_key"));
    raw.put("webpage_url", readText(root, "webpage_url", "original_url"));
    raw.put("upload_date", readText(root, "upload_date"));
    raw.put("view_count", root.path("view_count").isNumber() ? root.path("view_count").asLong() : null);
    raw.put("like_count", root.path("like_count").isNumber() ? root.path("like_count").asLong() : null);
    raw.put("duration_sec", metadata.durationSec > 0 ? metadata.durationSec : null);
    raw.put("title", metadata.title);
    raw.put("uploader", metadata.uploader);
    raw.put("tags", metadata.tags);
    metadata.rawMeta = raw;
    return metadata;
  }

  private String extractSubtitleWithYtDlp(String sourceUrl) throws IOException, InterruptedException {
    if (ytDlpCommand.isEmpty()) {
      return "";
    }

    Path tempDir = Files.createTempDirectory("sb-link-sub-");
    try {
      List<String> command = new ArrayList<>();
      command.add(ytDlpCommand);
      command.add("--skip-download");
      command.add("--no-playlist");
      command.add("--no-warnings");
      command.add("--write-subs");
      command.add("--write-auto-subs");
      command.add("--sub-format");
      command.add("vtt");
      command.add("--sub-langs");
      command.add("zh-Hans.*,zh-Hant.*,zh.*,en.*");
      command.add("--output");
      command.add("sub-%(id)s.%(ext)s");
      appendYtDlpCommonOptions(command);
      command.add(sourceUrl);
      CommandResult commandResult = runCommand(command, tempDir);
      if (!commandResult.success) {
        return "";
      }

      List<Path> subtitleFiles;
      try (var stream = Files.list(tempDir)) {
        subtitleFiles = stream
          .filter(path -> {
            String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
            return name.endsWith(".vtt") || name.endsWith(".srt") || name.endsWith(".ass");
          })
          .sorted(Comparator.comparingLong(this::safeSize).reversed())
          .toList();
      }
      if (subtitleFiles.isEmpty()) {
        return "";
      }

      String plain = toPlainSubtitleText(subtitleFiles.get(0));
      return truncate(plain, maxTextChars);
    } finally {
      cleanupTempDir(tempDir);
    }
  }

  private String extractSubtitleWithAsrFallback(String sourceUrl) throws IOException, InterruptedException {
    if (ytDlpCommand.isEmpty()) {
      return "";
    }
    if ("docker".equals(asrMode)) {
      if (asrDockerCommand.isEmpty()) {
        throw new IllegalStateException("ASR docker command is empty.");
      }
      if (asrDockerImage.isEmpty()) {
        throw new IllegalStateException("ASR docker image is empty.");
      }
    } else if (asrCommand.isEmpty()) {
      throw new IllegalStateException("ASR command is empty.");
    }

    Path tempDir = Files.createTempDirectory("sb-link-asr-");
    try {
      Path audioFile = downloadAudioForAsr(sourceUrl, tempDir);
      if (audioFile == null || !Files.exists(audioFile)) {
        return "";
      }

      Path preparedAudio = audioFile;
      if (!ffmpegCommand.isEmpty()) {
        Path wavFile = tempDir.resolve("asr-input.wav");
        List<String> ffmpeg = new ArrayList<>();
        ffmpeg.add(ffmpegCommand);
        ffmpeg.add("-y");
        ffmpeg.add("-i");
        ffmpeg.add(audioFile.toString());
        ffmpeg.add("-ac");
        ffmpeg.add("1");
        ffmpeg.add("-ar");
        ffmpeg.add("16000");
        ffmpeg.add(wavFile.toString());
        CommandResult ffmpegResult = runCommand(ffmpeg, tempDir, Math.min(180, asrTimeoutSeconds));
        if (ffmpegResult.success && Files.exists(wavFile)) {
          preparedAudio = wavFile;
        }
      }

      String transcript = transcribeAudioWithWhisper(preparedAudio, tempDir);
      return truncate(transcript, maxTextChars);
    } finally {
      cleanupTempDir(tempDir);
    }
  }

  private Path downloadAudioForAsr(String sourceUrl, Path tempDir) throws IOException, InterruptedException {
    List<String> command = new ArrayList<>();
    command.add(ytDlpCommand);
    command.add("--no-playlist");
    command.add("--no-warnings");
    command.add("--format");
    command.add("bestaudio/best");
    command.add("--output");
    command.add("asr-audio-%(id)s.%(ext)s");
    appendYtDlpCommonOptions(command);
    command.add(sourceUrl);
    CommandResult commandResult = runCommand(command, tempDir, ytDlpAudioTimeoutSeconds);
    if (!commandResult.success) {
      return null;
    }

    try (var stream = Files.list(tempDir)) {
      return stream
        .filter(path -> {
          String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
          return name.startsWith("asr-audio-")
            && (name.endsWith(".m4a")
            || name.endsWith(".mp3")
            || name.endsWith(".webm")
            || name.endsWith(".opus")
            || name.endsWith(".wav")
            || name.endsWith(".mp4"));
        })
        .sorted(Comparator.comparingLong(this::safeSize).reversed())
        .findFirst()
        .orElse(null);
    }
  }

  private String transcribeAudioWithWhisper(Path audioFile, Path workingDir) throws IOException, InterruptedException {
    if (audioFile == null || !Files.exists(audioFile)) {
      return "";
    }
    if ("docker".equals(asrMode)) {
      return transcribeAudioWithDockerWhisper(audioFile, workingDir);
    }
    return transcribeAudioWithLocalWhisper(audioFile, workingDir);
  }

  private String transcribeAudioWithLocalWhisper(Path audioFile, Path workingDir) throws IOException, InterruptedException {
    if (asrCommand.isEmpty()) {
      throw new IllegalStateException("ASR command is empty.");
    }
    List<String> command = new ArrayList<>();
    command.add(asrCommand);
    command.add(audioFile.toString());
    if (!asrModel.isEmpty()) {
      command.add("--model");
      command.add(asrModel);
    }
    if (!asrLanguage.isEmpty()) {
      command.add("--language");
      command.add(asrLanguage);
    }
    command.add("--task");
    command.add("transcribe");
    command.add("--output_format");
    command.add("txt");
    command.add("--output_dir");
    command.add(workingDir.toString());
    command.add("--fp16");
    command.add("False");

    CommandResult commandResult = runCommand(command, workingDir, asrTimeoutSeconds);
    if (!commandResult.success) {
      throw new IllegalStateException(commandResult.output);
    }
    return readTranscriptOutput(audioFile, workingDir);
  }

  private String transcribeAudioWithDockerWhisper(Path audioFile, Path workingDir) throws IOException, InterruptedException {
    if (asrDockerCommand.isEmpty()) {
      throw new IllegalStateException("ASR docker command is empty.");
    }
    if (asrDockerImage.isEmpty()) {
      throw new IllegalStateException("ASR docker image is empty.");
    }

    if (asrDockerPullMissing) {
      CommandResult inspectResult = runCommand(List.of(asrDockerCommand, "image", "inspect", asrDockerImage), workingDir, 40);
      if (!inspectResult.success) {
        CommandResult pullResult = runCommand(List.of(asrDockerCommand, "pull", asrDockerImage), workingDir, Math.max(180, asrTimeoutSeconds));
        if (!pullResult.success) {
          throw new IllegalStateException("docker_pull_failed:" + pullResult.output);
        }
      }
    }

    String mount = workingDir.toAbsolutePath().toString() + ":/data";
    String containerAudioPath = "/data/" + audioFile.getFileName();
    List<String> command = new ArrayList<>();
    command.add(asrDockerCommand);
    command.add("run");
    command.add("--rm");
    command.add("-v");
    command.add(mount);
    command.add(asrDockerImage);
    command.add("whisper");
    command.add(containerAudioPath);
    if (!asrModel.isEmpty()) {
      command.add("--model");
      command.add(asrModel);
    }
    if (!asrLanguage.isEmpty()) {
      command.add("--language");
      command.add(asrLanguage);
    }
    command.add("--task");
    command.add("transcribe");
    command.add("--output_format");
    command.add("txt");
    command.add("--output_dir");
    command.add("/data");
    command.add("--fp16");
    command.add("False");

    CommandResult commandResult = runCommand(command, workingDir, asrTimeoutSeconds);
    if (!commandResult.success) {
      throw new IllegalStateException(commandResult.output);
    }
    return readTranscriptOutput(audioFile, workingDir);
  }

  private String readTranscriptOutput(Path audioFile, Path workingDir) throws IOException {
    Path expected = workingDir.resolve(stripExtension(audioFile.getFileName().toString()) + ".txt");
    Path textFile;
    if (Files.exists(expected)) {
      textFile = expected;
    } else {
      try (var stream = Files.list(workingDir)) {
        textFile = stream
          .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".txt"))
          .sorted(Comparator.comparingLong(this::safeSize).reversed())
          .findFirst()
          .orElse(null);
      }
    }
    if (textFile == null || !Files.exists(textFile)) {
      return "";
    }
    String raw = Files.readString(textFile, StandardCharsets.UTF_8);
    return normalizeTranscriptText(raw);
  }

  private String normalizeTranscriptText(String raw) {
    if (raw == null || raw.isBlank()) {
      return "";
    }
    return raw.lines()
      .map(this::normalizeString)
      .filter(line -> !line.isEmpty())
      .collect(Collectors.joining(" "));
  }

  private ExtractedMetadata extractMetadataFromHtml(String sourceUrl) throws IOException, InterruptedException {
    HttpRequest request = HttpRequest.newBuilder(URI.create(sourceUrl))
      .timeout(Duration.ofSeconds(10))
      .header("User-Agent", userAgent)
      .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
      .GET()
      .build();
    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    if (response.statusCode() < 200 || response.statusCode() >= 400) {
      throw new IllegalStateException("status=" + response.statusCode());
    }

    String html = response.body();
    ExtractedMetadata metadata = new ExtractedMetadata();
    Map<String, String> metaMap = new LinkedHashMap<>();
    Matcher matcher = META_TAG_PATTERN.matcher(html);
    while (matcher.find()) {
      String key = normalizeString(matcher.group(1)).toLowerCase(Locale.ROOT);
      String value = decodeHtml(normalizeString(matcher.group(2)));
      if (!key.isEmpty() && !value.isEmpty()) {
        metaMap.putIfAbsent(key, value);
      }
    }
    String title = firstNonBlank(
      metaMap.get("og:title"),
      metaMap.get("twitter:title"),
      extractTitleTag(html)
    );
    String description = firstNonBlank(
      metaMap.get("og:description"),
      metaMap.get("description"),
      metaMap.get("twitter:description")
    );
    metadata.title = normalizeString(title);
    metadata.description = normalizeString(description);
    metadata.uploader = normalizeString(firstNonBlank(
      metaMap.get("author"),
      metaMap.get("og:site_name")
    ));
    metadata.tags = List.of();
    metadata.rawMeta = new LinkedHashMap<>();
    metadata.rawMeta.put("source", "html-meta");
    metadata.rawMeta.put("title", metadata.title);
    metadata.rawMeta.put("description", metadata.description);
    return metadata;
  }

  private CommandResult runCommand(List<String> command, Path workingDirectory) throws IOException, InterruptedException {
    return runCommand(command, workingDirectory, ytDlpTimeoutSeconds);
  }

  private CommandResult runCommand(
    List<String> command,
    Path workingDirectory,
    int timeoutSeconds
  ) throws IOException, InterruptedException {
    ProcessBuilder builder = new ProcessBuilder(command);
    builder.redirectErrorStream(true);
    Path outputFile = Files.createTempFile("sb-extractor-cmd-", ".log");
    builder.redirectOutput(outputFile.toFile());
    if (workingDirectory != null) {
      builder.directory(workingDirectory.toFile());
    }
    try {
      Process process = builder.start();
      boolean finished = process.waitFor(Math.max(5, timeoutSeconds), java.util.concurrent.TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        return new CommandResult(false, "process_timeout");
      }
      String output = Files.exists(outputFile)
        ? Files.readString(outputFile, StandardCharsets.UTF_8)
        : "";
      boolean success = process.exitValue() == 0;
      return new CommandResult(success, output);
    } finally {
      try {
        Files.deleteIfExists(outputFile);
      } catch (IOException ignored) {
        // ignore output cleanup failures
      }
    }
  }

  private void appendYtDlpCommonOptions(List<String> command) {
    if (command == null) {
      return;
    }
    if (!userAgent.isEmpty()) {
      command.add("--user-agent");
      command.add(userAgent);
    }
    if (!referer.isEmpty()) {
      command.add("--referer");
      command.add(referer);
    }
    if (!cookiesFromBrowser.isEmpty()) {
      command.add("--cookies-from-browser");
      command.add(cookiesFromBrowser);
    }
    if (!cookiesFile.isEmpty()) {
      command.add("--cookies");
      command.add(cookiesFile);
    }
  }

  private String toPlainSubtitleText(Path subtitleFile) {
    try {
      List<String> lines = Files.readAllLines(subtitleFile, StandardCharsets.UTF_8);
      List<String> cleaned = new ArrayList<>();
      for (String rawLine : lines) {
        String line = normalizeString(rawLine);
        if (line.isEmpty()) {
          continue;
        }
        if ("WEBVTT".equalsIgnoreCase(line) || line.startsWith("NOTE")) {
          continue;
        }
        if (line.matches("^\\d+$")) {
          continue;
        }
        if (SRT_TIME_PATTERN.matcher(line).matches() || VTT_TIME_PATTERN.matcher(line).matches()) {
          continue;
        }
        if (line.startsWith("Kind:") || line.startsWith("Language:")) {
          continue;
        }
        if (line.startsWith("Dialogue:")) {
          String dialogue = line.substring("Dialogue:".length()).trim();
          int idx = nthCommaIndex(dialogue, 9);
          if (idx >= 0 && idx + 1 < dialogue.length()) {
            line = dialogue.substring(idx + 1).trim();
          } else {
            continue;
          }
        }
        line = TAG_PATTERN.matcher(line).replaceAll("");
        line = line.replace("&nbsp;", " ").replace("&amp;", "&");
        if (!line.isEmpty()) {
          cleaned.add(line);
        }
      }
      return cleaned.stream()
        .filter(Objects::nonNull)
        .map(String::trim)
        .filter(text -> !text.isEmpty())
        .distinct()
        .collect(Collectors.joining(" "));
    } catch (IOException ignored) {
      return "";
    }
  }

  private int nthCommaIndex(String value, int nth) {
    int count = 0;
    for (int i = 0; i < value.length(); i += 1) {
      if (value.charAt(i) == ',') {
        count += 1;
        if (count == nth) {
          return i;
        }
      }
    }
    return -1;
  }

  private long safeSize(Path path) {
    try {
      return Files.size(path);
    } catch (IOException ignored) {
      return -1L;
    }
  }

  private void cleanupTempDir(Path tempDir) {
    if (tempDir == null) return;
    try {
      if (!Files.exists(tempDir)) return;
      try (var stream = Files.walk(tempDir)) {
        stream
          .sorted(Comparator.reverseOrder())
          .forEach(path -> {
            try {
              Files.deleteIfExists(path);
            } catch (IOException ignored) {
              // ignore cleanup failures
            }
          });
      }
    } catch (IOException ignored) {
      // ignore cleanup failures
    }
  }

  private String buildNormalizedSummary(ExtractionResult result) {
    List<String> parts = new ArrayList<>();
    if (!result.getTitle().isBlank()) {
      parts.add("title: " + result.getTitle());
    }
    if (!result.getDescription().isBlank()) {
      parts.add("description: " + result.getDescription());
    }
    if (!result.getUploader().isBlank()) {
      parts.add("uploader: " + result.getUploader());
    }
    if (result.getDurationSec() > 0) {
      parts.add("duration_sec: " + result.getDurationSec());
    }
    if (!result.getTags().isEmpty()) {
      parts.add("tags: " + String.join(", ", result.getTags()));
    }
    if (!result.getSubtitleText().isBlank()) {
      parts.add("subtitle: " + result.getSubtitleText());
    }
    return String.join("\n", parts).trim();
  }

  private String readText(JsonNode root, String... keys) {
    if (root == null) return "";
    for (String key : keys) {
      JsonNode node = root.get(key);
      if (node != null && node.isTextual()) {
        String text = normalizeString(node.asText(""));
        if (!text.isEmpty()) {
          return text;
        }
      }
    }
    return "";
  }

  private String extractTitleTag(String html) {
    Matcher matcher = TITLE_TAG_PATTERN.matcher(html);
    if (matcher.find()) {
      return decodeHtml(normalizeString(matcher.group(1)));
    }
    return "";
  }

  private String decodeHtml(String input) {
    if (input == null || input.isBlank()) return "";
    return input
      .replace("&amp;", "&")
      .replace("&lt;", "<")
      .replace("&gt;", ">")
      .replace("&quot;", "\"")
      .replace("&#39;", "'")
      .replace("&nbsp;", " ");
  }

  private String firstNonBlank(String... values) {
    if (values == null) return "";
    for (String value : values) {
      String normalized = normalizeString(value);
      if (!normalized.isEmpty()) {
        return normalized;
      }
    }
    return "";
  }

  private String truncate(String value, int maxLength) {
    if (value == null) return "";
    if (value.length() <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength);
  }

  private String stripExtension(String fileName) {
    String value = normalizeString(fileName);
    if (value.isEmpty()) return value;
    int lastDot = value.lastIndexOf('.');
    if (lastDot <= 0) return value;
    return value.substring(0, lastDot);
  }

  private String normalizeString(String value) {
    return value == null ? "" : value.trim();
  }

  public static class ExtractionResult {
    private String sourceUrl = "";
    private String title = "";
    private String description = "";
    private String uploader = "";
    private int durationSec;
    private List<String> tags = new ArrayList<>();
    private String subtitleText = "";
    private String summaryText = "";
    private final Map<String, Object> metadata = new LinkedHashMap<>();
    private final List<String> warnings = new ArrayList<>();

    public static ExtractionResult empty() {
      return new ExtractionResult();
    }

    public boolean hasAnyText() {
      return !subtitleText.isBlank() || !summaryText.isBlank() || !description.isBlank() || !title.isBlank();
    }

    public String getSourceUrl() {
      return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
      this.sourceUrl = sourceUrl;
    }

    public String getTitle() {
      return title;
    }

    public void setTitle(String title) {
      this.title = title == null ? "" : title.trim();
    }

    public String getDescription() {
      return description;
    }

    public void setDescription(String description) {
      this.description = description == null ? "" : description.trim();
    }

    public String getUploader() {
      return uploader;
    }

    public void setUploader(String uploader) {
      this.uploader = uploader == null ? "" : uploader.trim();
    }

    public int getDurationSec() {
      return durationSec;
    }

    public void setDurationSec(int durationSec) {
      this.durationSec = Math.max(0, durationSec);
    }

    public List<String> getTags() {
      return tags;
    }

    public void setTags(List<String> tags) {
      this.tags = tags == null ? new ArrayList<>() : tags;
    }

    public String getSubtitleText() {
      return subtitleText;
    }

    public void setSubtitleText(String subtitleText) {
      this.subtitleText = subtitleText == null ? "" : subtitleText.trim();
    }

    public String getSummaryText() {
      return summaryText;
    }

    public void setSummaryText(String summaryText) {
      this.summaryText = summaryText == null ? "" : summaryText.trim();
    }

    public Map<String, Object> getMetadata() {
      return metadata;
    }

    public List<String> getWarnings() {
      return warnings;
    }
  }

  private static class ExtractedMetadata {
    private String title = "";
    private String description = "";
    private String uploader = "";
    private int durationSec;
    private List<String> tags = List.of();
    private Map<String, Object> rawMeta = Map.of();
    private List<String> extractionErrors = List.of();
  }

  private static class CommandResult {
    private final boolean success;
    private final String output;

    private CommandResult(boolean success, String output) {
      this.success = success;
      this.output = output == null ? "" : output.trim();
    }
  }
}
