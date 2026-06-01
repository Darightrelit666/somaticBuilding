package com.somaticbuilding.exercise.interfaces;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.common.core.ErrorCode;
import com.somaticbuilding.exercise.application.ExerciseListCacheService;
import com.somaticbuilding.exercise.application.ExerciseMediaStorageService;
import com.somaticbuilding.exercise.application.ExerciseService;
import com.somaticbuilding.exercise.domain.Exercise;
import com.somaticbuilding.exercise.domain.ExerciseMedia;
import com.somaticbuilding.exercise.domain.ExerciseTag;
import com.somaticbuilding.exercise.interfaces.dto.ExerciseCreateRequest;
import com.somaticbuilding.exercise.interfaces.dto.ExerciseDetailResponse;
import com.somaticbuilding.exercise.interfaces.dto.ExerciseListItem;
import com.somaticbuilding.exercise.interfaces.dto.ExerciseListResponse;
import com.somaticbuilding.exercise.interfaces.dto.ExerciseMediaUploadResponse;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/exercise")
public class ExerciseController {
  private final ExerciseService exerciseService;
  private final ExerciseListCacheService listCacheService;
  private final ExerciseMediaStorageService mediaStorageService;
  private final boolean bulkMediaFetchEnabled;

  public ExerciseController(
    ExerciseService exerciseService,
    ExerciseListCacheService listCacheService,
    ExerciseMediaStorageService mediaStorageService,
    @Value("${exercise.performance.bulk-media-fetch-enabled:true}") boolean bulkMediaFetchEnabled
  ) {
    this.exerciseService = exerciseService;
    this.listCacheService = listCacheService;
    this.mediaStorageService = mediaStorageService;
    this.bulkMediaFetchEnabled = bulkMediaFetchEnabled;
  }

  @PostMapping("/custom")
  public ApiResponse<ExerciseDetailResponse> createCustom(
    @RequestBody ExerciseCreateRequest request
  ) {
    Exercise created = exerciseService.createCustomExercise(
      request.getName(),
      request.getPrimaryMuscle(),
      request.getEquipment(),
      request.getDifficulty(),
      request.getDescription(),
      request.getCoverUrl(),
      request.getVideoUrl()
    );
    ExerciseDetailResponse response = new ExerciseDetailResponse();
    response.setId(created.getId());
    response.setName(created.getName());
    response.setPrimaryMuscle(created.getPrimaryMuscle());
    response.setEquipment(created.getEquipment());
    response.setDifficulty(created.getDifficulty());
    response.setDescription(created.getDescription());
    return ApiResponse.success(response);
  }

  @GetMapping("/list")
  public ApiResponse<ExerciseListResponse> list(
    @RequestParam(value = "keyword", required = false) String keyword,
    @RequestParam(value = "tag_ids", required = false) String tagIds,
    @RequestParam(value = "primary_muscle", required = false) String primaryMuscle,
    @RequestParam(value = "difficulty", required = false) Integer difficulty,
    @RequestParam(value = "equipment", required = false) String equipment,
    @RequestParam(value = "page", required = false, defaultValue = "1") Integer page,
    @RequestParam(value = "page_size", required = false, defaultValue = "20") Integer pageSize
  ) {
    List<Long> tags = parseTags(tagIds);
    String cacheKey = listCacheService.buildKey(
      keyword,
      tags,
      primaryMuscle,
      difficulty,
      equipment,
      page,
      pageSize
    );
    ExerciseListResponse cached = listCacheService.get(cacheKey);
    if (cached != null) {
      return ApiResponse.success(cached);
    }

    Page<Exercise> result =
      exerciseService.listExercises(keyword, tags, primaryMuscle, difficulty, equipment, page, pageSize);
    ExerciseListResponse response = new ExerciseListResponse();
    response.setPage(page);
    response.setPageSize(pageSize);
    response.setTotal(result.getTotal());
    List<Long> exerciseIds =
      result.getRecords().stream()
        .map(Exercise::getId)
        .filter(Objects::nonNull)
        .collect(Collectors.toList());
    Map<Long, List<ExerciseMedia>> mediaByExerciseId =
      bulkMediaFetchEnabled
        ? exerciseService.fetchMediaByExerciseIds(exerciseIds)
        : Collections.emptyMap();
    List<ExerciseListItem> items =
      result.getRecords().stream().map(item -> {
        ExerciseListItem dto = new ExerciseListItem();
        dto.setId(item.getId());
        dto.setName(item.getName());
        dto.setPrimaryMuscle(item.getPrimaryMuscle());
        dto.setEquipment(item.getEquipment());
        dto.setDifficulty(item.getDifficulty());
        dto.setCoverUrl(
          bulkMediaFetchEnabled
            ? exerciseService.resolveCoverUrl(mediaByExerciseId.get(item.getId()))
            : exerciseService.resolveCoverUrl(item.getId())
        );
        return dto;
      }).collect(Collectors.toList());
    response.setList(items);
    listCacheService.put(cacheKey, response);
    return ApiResponse.success(response);
  }

  @GetMapping("/{id}")
  public ApiResponse<ExerciseDetailResponse> detail(@PathVariable("id") Long id) {
    Exercise exercise = exerciseService.getExercise(id);
    if (exercise == null) {
      return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Exercise not found.");
    }
    ExerciseDetailResponse response = new ExerciseDetailResponse();
    response.setId(exercise.getId());
    response.setName(exercise.getName());
    response.setPrimaryMuscle(exercise.getPrimaryMuscle());
    response.setEquipment(exercise.getEquipment());
    response.setDifficulty(exercise.getDifficulty());
    response.setDescription(exercise.getDescription());
    return ApiResponse.success(response);
  }

  @GetMapping("/{id}/media")
  public ApiResponse<List<ExerciseMedia>> media(@PathVariable("id") Long id) {
    return ApiResponse.success(exerciseService.listMedia(id));
  }

  @PostMapping(value = "/media/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ExerciseMediaUploadResponse> uploadMedia(
    @RequestParam("file") MultipartFile file,
    @RequestParam(value = "mediaType", required = false) String mediaType
  ) {
    ExerciseMediaStorageService.StoredMediaFile stored = mediaStorageService.save(file, mediaType);
    ExerciseMediaUploadResponse response = new ExerciseMediaUploadResponse();
    response.setFileName(stored.fileName());
    response.setMediaType(stored.mediaType());
    response.setContentType(stored.contentType());
    response.setSize(stored.size());
    response.setUrl(stored.url());
    return ApiResponse.success(response);
  }

  @GetMapping("/media/file/{fileName:.+}")
  public ResponseEntity<Resource> fetchMediaFile(@PathVariable("fileName") String fileName) {
    ExerciseMediaStorageService.StoredMediaFile stored = mediaStorageService.load(fileName);
    Path filePath = mediaStorageService.resolvePath(stored);
    Resource resource;
    try {
      resource = new UrlResource(filePath.toUri());
    } catch (Exception ex) {
      throw new IllegalArgumentException("Media file not found.");
    }
    if (!resource.exists() || !resource.isReadable()) {
      throw new IllegalArgumentException("Media file not found.");
    }
    MediaType contentType = MediaType.APPLICATION_OCTET_STREAM;
    try {
      if (stored.contentType() != null && !stored.contentType().isBlank()) {
        contentType = MediaType.parseMediaType(stored.contentType());
      }
    } catch (Exception ignored) {
      // keep fallback
    }

    return ResponseEntity
      .ok()
      .header(HttpHeaders.CACHE_CONTROL, "public, max-age=604800")
      .contentType(contentType)
      .contentLength(stored.size())
      .body(resource);
  }

  @GetMapping("/tags")
  public ApiResponse<List<ExerciseTag>> tags() {
    return ApiResponse.success(exerciseService.listTags());
  }

  @GetMapping("/{id}/tags")
  public ApiResponse<List<ExerciseTag>> tagsByExercise(@PathVariable("id") Long id) {
    return ApiResponse.success(exerciseService.listTagsByExercise(id));
  }

  private List<Long> parseTags(String raw) {
    if (raw == null || raw.isBlank()) {
      return Collections.emptyList();
    }
    return List.of(raw.split(",")).stream()
      .map(String::trim)
      .filter(value -> !value.isEmpty())
      .map(value -> {
        try {
          return Long.parseLong(value);
        } catch (NumberFormatException ex) {
          return null;
        }
      })
      .filter(value -> value != null)
      .collect(Collectors.toList());
  }
}
