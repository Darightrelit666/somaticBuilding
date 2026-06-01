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
public class VideoClipExtractionService {
  private final boolean enabled;
  private final String ytDlpCommand;
  private final String ffmpegCommand;
  private final String userAgent;
  private final String cookiesFromBrowser;
  private final String cookiesFile;
  private final String referer;
  private final int clipTimeoutSeconds;
  private final int minDurationSeconds;
  private final int maxDurationSeconds;

  public VideoClipExtractionService(
    @Value("${integration.content-extractor.enabled:true}") boolean extractorEnabled,
    @Value("${integration.content-extractor.clip.enabled:true}") boolean clipEnabled,
    @Value("${integration.content-extractor.yt-dlp.command:yt-dlp}") String ytDlpCommand,
    @Value("${integration.content-extractor.yt-dlp.cookies-from-browser:}") String cookiesFromBrowser,
    @Value("${integration.content-extractor.yt-dlp.cookies-file:}") String cookiesFile,
    @Value("${integration.content-extractor.yt-dlp.referer:}") String referer,
    @Value("${integration.content-extractor.user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36}") String userAgent,
    @Value("${integration.content-extractor.ffmpeg.command:ffmpeg}") String ffmpegCommand,
    @Value("${integration.content-extractor.clip.timeout-seconds:240}") int clipTimeoutSeconds,
    @Value("${integration.content-extractor.clip.min-duration-seconds:8}") int minDurationSeconds,
    @Value("${integration.content-extractor.clip.max-duration-seconds:40}") int maxDurationSeconds
  ) {
    this.enabled = extractorEnabled && clipEnabled;
    this.ytDlpCommand = normalizeString(ytDlpCommand);
    this.ffmpegCommand = normalizeString(ffmpegCommand);
    this.userAgent = normalizeString(userAgent);
    this.cookiesFromBrowser = normalizeString(cookiesFromBrowser);
    this.cookiesFile = normalizeString(cookiesFile);
    this.referer = normalizeString(referer);
    this.clipTimeoutSeconds = Math.max(30, clipTimeoutSeconds);
    this.minDurationSeconds = Math.max(4, minDurationSeconds);
    this.maxDurationSeconds = Math.max(this.minDurationSeconds, maxDurationSeconds);
  }

  public ClipAsset extract(
    String sourceUrl,
    BigDecimal startSec,
    BigDecimal endSec,
    String preferredName
  ) {
    String normalizedUrl = normalizeString(sourceUrl);
    if (!enabled || normalizedUrl.isEmpty()) {
      return ClipAsset.empty("clip_extractor_disabled_or_source_missing");
    }
    if (ytDlpCommand.isEmpty() || ffmpegCommand.isEmpty()) {
      return ClipAsset.empty("clip_extractor_command_missing");
    }

    Path tempDir = null;
    try {
      tempDir = Files.createTempDirectory("sb-auto-clip-");
      Path sourceFile = downloadVideo(normalizedUrl, tempDir);
      if (sourceFile == null || !Files.exists(sourceFile)) {
        return ClipAsset.empty("video_download_failed");
      }

      ClipTiming timing = resolveTiming(startSec, endSec);
      String safeBaseName = sanitizeBaseName(preferredName);
      String videoFileName = "clip-" + safeBaseName + "-" + Instant.now().toEpochMilli() + ".mp4";
      String coverFileName = "clip-cover-" + safeBaseName + "-" + Instant.now().toEpochMilli() + ".jpg";
      Path outputVideo = tempDir.resolve(videoFileName);
      Path outputCover = tempDir.resolve(coverFileName);

      CommandResult clipResult = buildClip(sourceFile, outputVideo, timing);
      if (!clipResult.success || !Files.exists(outputVideo)) {
        return ClipAsset.empty("clip_render_failed:" + clipResult.output);
      }

      CommandResult coverResult = extractCover(sourceFile, outputCover, timing);
      byte[] coverBytes = null;
      if (coverResult.success && Files.exists(outputCover)) {
        coverBytes = Files.readAllBytes(outputCover);
      }

      byte[] videoBytes = Files.readAllBytes(outputVideo);
      ClipAsset asset = new ClipAsset(
        videoFileName,
        "video/mp4",
        videoBytes,
        coverBytes == null ? null : coverFileName,
        coverBytes == null ? null : "image/jpeg",
        coverBytes
      );
      if (!coverResult.success) {
        asset.getWarnings().add("cover_extract_failed:" + coverResult.output);
      }
      return asset;
    } catch (Exception ex) {
      return ClipAsset.empty("clip_extractor_exception:" + ex.getMessage());
    } finally {
      cleanupTempDir(tempDir);
    }
  }

  private Path downloadVideo(String sourceUrl, Path tempDir) throws IOException, InterruptedException {
    List<String> command = new ArrayList<>();
    command.add(ytDlpCommand);
    command.add("--no-playlist");
    command.add("--no-warnings");
    command.add("--merge-output-format");
    command.add("mp4");
    command.add("-f");
    command.add("mp4/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best");
    command.add("--output");
    command.add("clip-source-%(id)s.%(ext)s");
    appendYtDlpCommonOptions(command);
    command.add(sourceUrl);

    CommandResult downloadResult = runCommand(command, tempDir, clipTimeoutSeconds);
    if (!downloadResult.success) {
      return null;
    }

    try (var stream = Files.list(tempDir)) {
      return stream
        .filter(path -> {
          String lower = path.getFileName().toString().toLowerCase(Locale.ROOT);
          return lower.startsWith("clip-source-")
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

  private CommandResult buildClip(Path sourceFile, Path outputFile, ClipTiming timing) throws IOException, InterruptedException {
    List<String> command = new ArrayList<>();
    command.add(ffmpegCommand);
    command.add("-y");
    command.add("-ss");
    command.add(formatSeconds(timing.startSec));
    command.add("-i");
    command.add(sourceFile.toString());
    command.add("-t");
    command.add(formatSeconds(timing.durationSec));
    command.add("-vf");
    command.add("scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p");
    command.add("-c:v");
    command.add("libx264");
    command.add("-preset");
    command.add("veryfast");
    command.add("-pix_fmt");
    command.add("yuv420p");
    command.add("-c:a");
    command.add("aac");
    command.add("-b:a");
    command.add("128k");
    command.add("-movflags");
    command.add("+faststart");
    command.add(outputFile.toString());

    CommandResult result = runCommand(command, outputFile.getParent(), clipTimeoutSeconds);
    if (result.success) {
      return result;
    }

    List<String> fallbackCommand = new ArrayList<>(command);
    fallbackCommand.remove("-c:a");
    fallbackCommand.remove("aac");
    fallbackCommand.remove("-b:a");
    fallbackCommand.remove("128k");
    int movFlagsIndex = Math.max(0, fallbackCommand.indexOf("-movflags"));
    fallbackCommand.add(movFlagsIndex, "-an");
    return runCommand(fallbackCommand, outputFile.getParent(), clipTimeoutSeconds);
  }

  private CommandResult extractCover(Path sourceFile, Path outputFile, ClipTiming timing) throws IOException, InterruptedException {
    BigDecimal frameOffset = timing.startSec.add(BigDecimal.valueOf(Math.min(1, timing.durationSec.intValue())));
    List<String> command = new ArrayList<>();
    command.add(ffmpegCommand);
    command.add("-y");
    command.add("-ss");
    command.add(formatSeconds(frameOffset));
    command.add("-i");
    command.add(sourceFile.toString());
    command.add("-frames:v");
    command.add("1");
    command.add("-vf");
    command.add("scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black");
    command.add(outputFile.toString());
    return runCommand(command, outputFile.getParent(), Math.max(30, clipTimeoutSeconds / 2));
  }

  private ClipTiming resolveTiming(BigDecimal startSec, BigDecimal endSec) {
    BigDecimal start = startSec == null ? BigDecimal.ZERO : startSec;
    if (start.compareTo(BigDecimal.ZERO) < 0) {
      start = BigDecimal.ZERO;
    }

    BigDecimal rawDuration = endSec == null
      ? BigDecimal.valueOf(minDurationSeconds)
      : endSec.subtract(start);
    if (rawDuration.compareTo(BigDecimal.valueOf(minDurationSeconds)) < 0) {
      rawDuration = BigDecimal.valueOf(minDurationSeconds);
    }
    if (rawDuration.compareTo(BigDecimal.valueOf(maxDurationSeconds)) > 0) {
      rawDuration = BigDecimal.valueOf(maxDurationSeconds);
    }
    return new ClipTiming(start, rawDuration);
  }

  private String sanitizeBaseName(String value) {
    String normalized = normalizeString(value).toLowerCase(Locale.ROOT);
    if (normalized.isEmpty()) {
      return "movement";
    }
    String slug = normalized.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    if (slug.isEmpty()) {
      return "movement";
    }
    return slug.length() > 48 ? slug.substring(0, 48) : slug;
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
    Path outputFile = Files.createTempFile("sb-clip-cmd-", ".log");
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
        // ignore cleanup failures
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

  private static class ClipTiming {
    private final BigDecimal startSec;
    private final BigDecimal durationSec;

    private ClipTiming(BigDecimal startSec, BigDecimal durationSec) {
      this.startSec = startSec;
      this.durationSec = durationSec;
    }
  }

  private static class CommandResult {
    private final boolean success;
    private final String output;

    private CommandResult(boolean success, String output) {
      this.success = success;
      this.output = output == null ? "" : output.trim();
    }
  }

  public static class ClipAsset {
    private final String videoFileName;
    private final String videoContentType;
    private final byte[] videoBytes;
    private final String coverFileName;
    private final String coverContentType;
    private final byte[] coverBytes;
    private final Set<String> warnings = new LinkedHashSet<>();

    public static ClipAsset empty(String warning) {
      ClipAsset asset = new ClipAsset(null, null, null, null, null, null);
      if (warning != null && !warning.isBlank()) {
        asset.warnings.add(warning.trim());
      }
      return asset;
    }

    public ClipAsset(
      String videoFileName,
      String videoContentType,
      byte[] videoBytes,
      String coverFileName,
      String coverContentType,
      byte[] coverBytes
    ) {
      this.videoFileName = videoFileName;
      this.videoContentType = videoContentType;
      this.videoBytes = videoBytes;
      this.coverFileName = coverFileName;
      this.coverContentType = coverContentType;
      this.coverBytes = coverBytes;
    }

    public boolean hasVideo() {
      return videoBytes != null && videoBytes.length > 0 && videoFileName != null && !videoFileName.isBlank();
    }

    public boolean hasCover() {
      return coverBytes != null && coverBytes.length > 0 && coverFileName != null && !coverFileName.isBlank();
    }

    public String getVideoFileName() {
      return videoFileName;
    }

    public String getVideoContentType() {
      return videoContentType;
    }

    public byte[] getVideoBytes() {
      return videoBytes;
    }

    public String getCoverFileName() {
      return coverFileName;
    }

    public String getCoverContentType() {
      return coverContentType;
    }

    public byte[] getCoverBytes() {
      return coverBytes;
    }

    public Set<String> getWarnings() {
      return warnings;
    }

    public List<String> warningsAsList() {
      return new ArrayList<>(warnings);
    }
  }
}
