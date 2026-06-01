package com.somaticbuilding.aiassistant.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Component
public class VideoFrameExtractionService {
  private final boolean enabled;
  private final String ytDlpCommand;
  private final String ffmpegCommand;
  private final String ffprobeCommand;
  private final String userAgent;
  private final String cookiesFromBrowser;
  private final String cookiesFile;
  private final String referer;
  private final Path storageDir;
  private final int timeoutSeconds;
  private final int intervalSeconds;
  private final int maxFrames;
  private final int maxAnalysisSeconds;

  public VideoFrameExtractionService(
    @Value("${integration.content-extractor.enabled:true}") boolean extractorEnabled,
    @Value("${integration.content-extractor.frames.enabled:true}") boolean framesEnabled,
    @Value("${integration.content-extractor.yt-dlp.command:yt-dlp}") String ytDlpCommand,
    @Value("${integration.content-extractor.yt-dlp.cookies-from-browser:}") String cookiesFromBrowser,
    @Value("${integration.content-extractor.yt-dlp.cookies-file:}") String cookiesFile,
    @Value("${integration.content-extractor.yt-dlp.referer:}") String referer,
    @Value("${integration.content-extractor.user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36}") String userAgent,
    @Value("${integration.content-extractor.ffmpeg.command:ffmpeg}") String ffmpegCommand,
    @Value("${integration.content-extractor.ffprobe.command:ffprobe}") String ffprobeCommand,
    @Value("${integration.content-extractor.frames.storage-dir:D:/somaticBuilding/data/content-analysis-frames}") String storageDir,
    @Value("${integration.content-extractor.frames.timeout-seconds:240}") int timeoutSeconds,
    @Value("${integration.content-extractor.frames.interval-seconds:2}") int intervalSeconds,
    @Value("${integration.content-extractor.frames.max-frames:12}") int maxFrames,
    @Value("${integration.content-extractor.frames.max-analysis-seconds:180}") int maxAnalysisSeconds
  ) {
    this.enabled = extractorEnabled && framesEnabled;
    this.ytDlpCommand = normalizeString(ytDlpCommand);
    this.ffmpegCommand = normalizeString(ffmpegCommand);
    this.ffprobeCommand = normalizeString(ffprobeCommand);
    this.userAgent = normalizeString(userAgent);
    this.cookiesFromBrowser = normalizeString(cookiesFromBrowser);
    this.cookiesFile = normalizeString(cookiesFile);
    this.referer = normalizeString(referer);
    this.storageDir = Path.of(normalizeString(storageDir).isEmpty()
      ? "D:/somaticBuilding/data/content-analysis-frames"
      : normalizeString(storageDir));
    this.timeoutSeconds = Math.max(30, timeoutSeconds);
    this.intervalSeconds = Math.max(1, intervalSeconds);
    this.maxFrames = Math.max(1, Math.min(30, maxFrames));
    this.maxAnalysisSeconds = Math.max(30, maxAnalysisSeconds);
  }

  public FrameExtractionResult extract(String sourceUrl, Long jobId) {
    String normalizedUrl = normalizeString(sourceUrl);
    if (!enabled || normalizedUrl.isEmpty()) {
      return FrameExtractionResult.empty("frame_extractor_disabled_or_source_missing");
    }
    if (ytDlpCommand.isEmpty() || ffmpegCommand.isEmpty()) {
      return FrameExtractionResult.empty("frame_extractor_command_missing");
    }

    Path tempDir = null;
    try {
      tempDir = Files.createTempDirectory("sb-frame-source-");
      Path sourceFile = downloadVideo(normalizedUrl, tempDir);
      if (sourceFile == null || !Files.exists(sourceFile)) {
        return FrameExtractionResult.empty("video_download_failed");
      }

      Path outputDir = storageDir
        .resolve("job-" + (jobId == null ? "unknown" : jobId))
        .resolve(String.valueOf(Instant.now().toEpochMilli()));
      Files.createDirectories(outputDir);

      BigDecimal durationSeconds = probeDurationSeconds(sourceFile);
      List<BigDecimal> timestamps = buildEvenFrameTimestamps(durationSeconds, maxFrames);
      CommandResult frameResult = timestamps.isEmpty()
        ? extractFixedIntervalFrames(sourceFile, outputDir)
        : extractTimestampFrames(sourceFile, outputDir, timestamps);
      if (!frameResult.success) {
        return FrameExtractionResult.empty("frame_extract_failed:" + frameResult.output);
      }

      List<FrameAsset> frames = listFrameAssets(outputDir, timestamps);
      if (frames.isEmpty()) {
        return FrameExtractionResult.empty("frame_extract_empty");
      }
      FrameExtractionResult result = new FrameExtractionResult(frames);
      result.getWarnings().addAll(extractSceneFramesBestEffort(sourceFile, outputDir));
      return result;
    } catch (Exception ex) {
      return FrameExtractionResult.empty("frame_extractor_exception:" + ex.getMessage());
    } finally {
      cleanupTempDir(tempDir);
    }
  }

  private Path downloadVideo(String sourceUrl, Path tempDir) throws IOException, InterruptedException {
    List<String> command = new ArrayList<>();
    command.add(ytDlpCommand);
    command.add("--no-playlist");
    command.add("--no-warnings");
    command.add("--download-sections");
    command.add("*0-" + maxAnalysisSeconds);
    command.add("--merge-output-format");
    command.add("mp4");
    command.add("-f");
    command.add("mp4/bestvideo[height<=720]+bestaudio/best[height<=720]/best");
    command.add("--output");
    command.add("frame-source-%(id)s.%(ext)s");
    appendYtDlpCommonOptions(command);
    command.add(sourceUrl);

    CommandResult result = runCommand(command, tempDir, timeoutSeconds);
    if (!result.success) {
      return null;
    }

    try (var stream = Files.list(tempDir)) {
      return stream
        .filter(path -> {
          String lower = path.getFileName().toString().toLowerCase(Locale.ROOT);
          return lower.startsWith("frame-source-")
            && (lower.endsWith(".mp4")
            || lower.endsWith(".mov")
            || lower.endsWith(".mkv")
            || lower.endsWith(".webm")
            || lower.endsWith(".m4v"));
        })
        .sorted(Comparator.comparingLong(this::safeSize).reversed())
        .findFirst()
        .orElse(null);
    }
  }

  private CommandResult extractFixedIntervalFrames(Path sourceFile, Path outputDir) throws IOException, InterruptedException {
    List<String> command = new ArrayList<>();
    command.add(ffmpegCommand);
    command.add("-y");
    command.add("-i");
    command.add(sourceFile.toString());
    command.add("-vf");
    command.add("fps=1/" + intervalSeconds + ",scale=640:-2");
    command.add("-frames:v");
    command.add(String.valueOf(maxFrames));
    command.add("-q:v");
    command.add("3");
    command.add(outputDir.resolve("frame-%03d.jpg").toString());
    return runCommand(command, outputDir, timeoutSeconds);
  }

  private CommandResult extractTimestampFrames(
    Path sourceFile,
    Path outputDir,
    List<BigDecimal> timestamps
  ) throws IOException, InterruptedException {
    StringBuilder combinedOutput = new StringBuilder();
    int successCount = 0;
    for (int i = 0; i < timestamps.size(); i += 1) {
      BigDecimal timestamp = timestamps.get(i);
      Path target = outputDir.resolve("frame-%03d.jpg".formatted(i + 1));
      List<String> command = new ArrayList<>();
      command.add(ffmpegCommand);
      command.add("-y");
      command.add("-ss");
      command.add(formatSeconds(timestamp));
      command.add("-i");
      command.add(sourceFile.toString());
      command.add("-frames:v");
      command.add("1");
      command.add("-vf");
      command.add("scale=640:-2");
      command.add("-q:v");
      command.add("3");
      command.add(target.toString());
      CommandResult result = runCommand(command, outputDir, Math.max(20, Math.min(60, timeoutSeconds / 3)));
      if (result.success && Files.exists(target)) {
        successCount += 1;
      } else {
        combinedOutput.append(result.output).append('\n');
      }
    }
    if (successCount > 0) {
      return new CommandResult(true, combinedOutput.toString());
    }
    return new CommandResult(false, combinedOutput.isEmpty() ? "timestamp_frame_extract_empty" : combinedOutput.toString());
  }

  private BigDecimal probeDurationSeconds(Path sourceFile) {
    if (sourceFile == null || !Files.exists(sourceFile) || ffprobeCommand.isEmpty()) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
    try {
      List<String> command = new ArrayList<>();
      command.add(ffprobeCommand);
      command.add("-v");
      command.add("error");
      command.add("-show_entries");
      command.add("format=duration");
      command.add("-of");
      command.add("default=noprint_wrappers=1:nokey=1");
      command.add(sourceFile.toString());
      CommandResult result = runCommand(command, sourceFile.getParent(), Math.max(10, Math.min(30, timeoutSeconds / 4)));
      if (!result.success) {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
      }
      String firstLine = result.output.lines()
        .map(this::normalizeString)
        .filter(line -> !line.isEmpty())
        .findFirst()
        .orElse("");
      if (firstLine.isEmpty()) {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
      }
      return new BigDecimal(firstLine).setScale(2, RoundingMode.HALF_UP);
    } catch (Exception ignored) {
      return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
  }

  private List<BigDecimal> buildEvenFrameTimestamps(BigDecimal durationSeconds, int limit) {
    if (durationSeconds == null || durationSeconds.compareTo(BigDecimal.valueOf(2)) < 0 || limit <= 0) {
      return List.of();
    }
    double duration = Math.min(durationSeconds.doubleValue(), maxAnalysisSeconds);
    int count = Math.max(1, Math.min(limit, (int) Math.ceil(duration / Math.max(2, intervalSeconds))));
    count = Math.min(count, maxFrames);
    double step = duration / (count + 1d);
    List<BigDecimal> timestamps = new ArrayList<>();
    for (int i = 0; i < count; i += 1) {
      double second = Math.max(0.5d, Math.min(duration - 0.25d, step * (i + 1d)));
      timestamps.add(BigDecimal.valueOf(second).setScale(2, RoundingMode.HALF_UP));
    }
    return timestamps;
  }

  private Set<String> extractSceneFramesBestEffort(Path sourceFile, Path outputDir) {
    Set<String> warnings = new LinkedHashSet<>();
    Path sceneDir = outputDir.resolve("scene");
    try {
      Files.createDirectories(sceneDir);
      List<String> command = new ArrayList<>();
      command.add(ffmpegCommand);
      command.add("-y");
      command.add("-i");
      command.add(sourceFile.toString());
      command.add("-vf");
      command.add("select='gt(scene,0.35)',scale=640:-2");
      command.add("-vsync");
      command.add("vfr");
      command.add("-frames:v");
      command.add(String.valueOf(Math.min(6, maxFrames)));
      command.add("-q:v");
      command.add("3");
      command.add(sceneDir.resolve("scene-%03d.jpg").toString());
      CommandResult result = runCommand(command, sceneDir, Math.max(30, timeoutSeconds / 2));
      if (!result.success) {
        warnings.add("scene_frame_extract_failed:" + result.output);
      }
    } catch (Exception ex) {
      warnings.add("scene_frame_extract_exception:" + ex.getMessage());
    }
    return warnings;
  }

  private List<FrameAsset> listFrameAssets(Path outputDir, List<BigDecimal> timestamps) throws IOException {
    try (var stream = Files.list(outputDir)) {
      List<Path> paths = stream
        .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".jpg"))
        .sorted()
        .limit(maxFrames)
        .toList();
      List<FrameAsset> frames = new ArrayList<>();
      for (int i = 0; i < paths.size(); i += 1) {
        Path path = paths.get(i);
        BigDecimal approxSec = timestamps != null && i < timestamps.size()
          ? timestamps.get(i)
          : BigDecimal.valueOf((long) i * intervalSeconds).setScale(2, RoundingMode.HALF_UP);
        frames.add(new FrameAsset(
          i + 1,
          approxSec,
          path.toAbsolutePath().toString(),
          safeSize(path)
        ));
      }
      return frames;
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

  private String formatSeconds(BigDecimal value) {
    BigDecimal safe = value == null ? BigDecimal.ZERO : value;
    if (safe.compareTo(BigDecimal.ZERO) < 0) {
      safe = BigDecimal.ZERO;
    }
    return safe.setScale(3, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
  }

  private CommandResult runCommand(List<String> command, Path workingDirectory, int timeoutSeconds) throws IOException, InterruptedException {
    ProcessBuilder builder = new ProcessBuilder(command);
    builder.redirectErrorStream(true);
    Path outputFile = Files.createTempFile("sb-frame-cmd-", ".log");
    builder.redirectOutput(outputFile.toFile());
    if (workingDirectory != null) {
      builder.directory(workingDirectory.toFile());
    }
    try {
      Process process = builder.start();
      boolean finished = process.waitFor(Math.max(10, timeoutSeconds), java.util.concurrent.TimeUnit.SECONDS);
      if (!finished) {
        process.destroyForcibly();
        return new CommandResult(false, "process_timeout");
      }
      String output = Files.exists(outputFile)
        ? Files.readString(outputFile, StandardCharsets.UTF_8)
        : "";
      return new CommandResult(process.exitValue() == 0, output);
    } finally {
      try {
        Files.deleteIfExists(outputFile);
      } catch (IOException ignored) {
        // ignore command output cleanup failures
      }
    }
  }

  private long safeSize(Path path) {
    try {
      return Files.size(path);
    } catch (IOException ignored) {
      return -1L;
    }
  }

  private void cleanupTempDir(Path tempDir) {
    if (tempDir == null) {
      return;
    }
    try {
      if (!Files.exists(tempDir)) {
        return;
      }
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

  private String normalizeString(String value) {
    return value == null ? "" : value.trim();
  }

  private static class CommandResult {
    private final boolean success;
    private final String output;

    private CommandResult(boolean success, String output) {
      this.success = success;
      this.output = output == null ? "" : output.trim();
    }
  }

  public static class FrameExtractionResult {
    private final List<FrameAsset> frames;
    private final Set<String> warnings = new LinkedHashSet<>();

    public static FrameExtractionResult empty(String warning) {
      FrameExtractionResult result = new FrameExtractionResult(List.of());
      if (warning != null && !warning.isBlank()) {
        result.warnings.add(warning.trim());
      }
      return result;
    }

    public FrameExtractionResult(List<FrameAsset> frames) {
      this.frames = frames == null ? List.of() : frames;
    }

    public boolean hasFrames() {
      return !frames.isEmpty();
    }

    public List<FrameAsset> getFrames() {
      return frames;
    }

    public Set<String> getWarnings() {
      return warnings;
    }
  }

  public static class FrameAsset {
    private final int index;
    private final BigDecimal approxSec;
    private final String filePath;
    private final long bytes;

    public FrameAsset(int index, BigDecimal approxSec, String filePath, long bytes) {
      this.index = index;
      this.approxSec = approxSec;
      this.filePath = filePath == null ? "" : filePath.trim();
      this.bytes = bytes;
    }

    public int getIndex() {
      return index;
    }

    public BigDecimal getApproxSec() {
      return approxSec;
    }

    public String getFilePath() {
      return filePath;
    }

    public long getBytes() {
      return bytes;
    }
  }
}
