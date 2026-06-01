package com.somaticbuilding.exercise.application;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class ExerciseMediaStorageService {
  private static final Set<String> IMAGE_EXTENSIONS =
    Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif");
  private static final Set<String> VIDEO_EXTENSIONS =
    Set.of(".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv");
  private static final Pattern SAFE_FILE_NAME = Pattern.compile("[a-zA-Z0-9._-]+");
  private static final long MAX_IMAGE_BYTES = 15L * 1024L * 1024L;
  private static final long MAX_VIDEO_BYTES = 200L * 1024L * 1024L;

  private final Path storageRoot;

  public ExerciseMediaStorageService(
    @Value("${exercise.media.storage-path:./storage/exercise-media}") String storagePath
  ) {
    this.storageRoot = Paths.get(storagePath).toAbsolutePath().normalize();
  }

  public StoredMediaFile save(MultipartFile file, String mediaType) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("Please choose a file to upload.");
    }
    String normalizedType = normalizeMediaType(mediaType);
    validateFileSize(file, normalizedType);

    String originalName = file.getOriginalFilename();
    String extension = resolveExtension(originalName, normalizedType);
    String fileName =
      normalizedType
        + "-"
        + System.currentTimeMillis()
        + "-"
        + UUID.randomUUID().toString().replace("-", "")
        + extension;

    Path targetPath = storageRoot.resolve(fileName).normalize();
    ensureInStorageRoot(targetPath);

    try {
      Files.createDirectories(storageRoot);
      try (InputStream inputStream = file.getInputStream()) {
        Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException ex) {
      throw new IllegalArgumentException("Failed to store media file.");
    }

    String detectedContentType = detectContentType(targetPath, normalizedType);
    String url = "/api/v1/exercise/media/file/" + fileName;
    return new StoredMediaFile(fileName, url, normalizedType, detectedContentType, file.getSize());
  }

  public StoredMediaFile load(String fileName) {
    if (!StringUtils.hasText(fileName) || !SAFE_FILE_NAME.matcher(fileName).matches()) {
      throw new IllegalArgumentException("Invalid media file path.");
    }

    Path targetPath = storageRoot.resolve(fileName).normalize();
    ensureInStorageRoot(targetPath);
    if (!Files.exists(targetPath) || !Files.isRegularFile(targetPath)) {
      throw new IllegalArgumentException("Media file not found.");
    }

    String mediaType = inferMediaTypeByExtension(fileName);
    String contentType = detectContentType(targetPath, mediaType);
    long size;
    try {
      size = Files.size(targetPath);
    } catch (IOException ex) {
      size = 0L;
    }
    return new StoredMediaFile(fileName, "/api/v1/exercise/media/file/" + fileName, mediaType, contentType, size);
  }

  public Path resolvePath(StoredMediaFile file) {
    Path path = storageRoot.resolve(file.fileName()).normalize();
    ensureInStorageRoot(path);
    return path;
  }

  private void ensureInStorageRoot(Path path) {
    if (!path.startsWith(storageRoot)) {
      throw new IllegalArgumentException("Illegal media path.");
    }
  }

  private String normalizeMediaType(String mediaType) {
    if (!StringUtils.hasText(mediaType)) {
      return "image";
    }
    String normalized = mediaType.trim().toLowerCase(Locale.ROOT);
    if ("image".equals(normalized) || "video".equals(normalized)) {
      return normalized;
    }
    throw new IllegalArgumentException("mediaType must be image or video.");
  }

  private void validateFileSize(MultipartFile file, String mediaType) {
    long size = file.getSize();
    long limit = "video".equals(mediaType) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (size <= 0L) {
      throw new IllegalArgumentException("Upload file is empty.");
    }
    if (size > limit) {
      throw new IllegalArgumentException(
        "video".equals(mediaType)
          ? "Video file is too large. Max size is 200MB."
          : "Image file is too large. Max size is 15MB."
      );
    }
  }

  private String resolveExtension(String fileName, String mediaType) {
    String extension = "";
    if (StringUtils.hasText(fileName)) {
      String trimmed = fileName.trim();
      int dotIndex = trimmed.lastIndexOf('.');
      if (dotIndex >= 0 && dotIndex < trimmed.length() - 1) {
        extension = trimmed.substring(dotIndex).toLowerCase(Locale.ROOT);
      }
    }

    Set<String> allowed = "video".equals(mediaType) ? VIDEO_EXTENSIONS : IMAGE_EXTENSIONS;
    if (allowed.contains(extension)) {
      return extension;
    }
    return "video".equals(mediaType) ? ".mp4" : ".jpg";
  }

  private String inferMediaTypeByExtension(String fileName) {
    if (!StringUtils.hasText(fileName)) {
      return "image";
    }
    String lower = fileName.toLowerCase(Locale.ROOT);
    for (String ext : VIDEO_EXTENSIONS) {
      if (lower.endsWith(ext)) return "video";
    }
    return "image";
  }

  private String detectContentType(Path path, String mediaType) {
    try {
      String detected = Files.probeContentType(path);
      if (StringUtils.hasText(detected)) {
        return detected;
      }
    } catch (IOException ignored) {
      // fallback below
    }
    return "video".equals(mediaType) ? "video/mp4" : "image/jpeg";
  }

  public record StoredMediaFile(
    String fileName,
    String url,
    String mediaType,
    String contentType,
    long size
  ) {}
}
