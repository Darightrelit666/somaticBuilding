package com.somaticbuilding.exercise.application;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.somaticbuilding.exercise.domain.Exercise;
import com.somaticbuilding.exercise.domain.ExerciseMedia;
import com.somaticbuilding.exercise.domain.ExerciseTag;
import com.somaticbuilding.exercise.domain.ExerciseTagMap;
import com.somaticbuilding.exercise.infrastructure.mapper.ExerciseMapper;
import com.somaticbuilding.exercise.infrastructure.mapper.ExerciseMediaMapper;
import com.somaticbuilding.exercise.infrastructure.mapper.ExerciseTagMapMapper;
import com.somaticbuilding.exercise.infrastructure.mapper.ExerciseTagMapper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Objects;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ExerciseService {
  private final ExerciseMapper exerciseMapper;
  private final ExerciseMediaMapper exerciseMediaMapper;
  private final ExerciseTagMapper exerciseTagMapper;
  private final ExerciseTagMapMapper exerciseTagMapMapper;

  public ExerciseService(
    ExerciseMapper exerciseMapper,
    ExerciseMediaMapper exerciseMediaMapper,
    ExerciseTagMapper exerciseTagMapper,
    ExerciseTagMapMapper exerciseTagMapMapper
  ) {
    this.exerciseMapper = exerciseMapper;
    this.exerciseMediaMapper = exerciseMediaMapper;
    this.exerciseTagMapper = exerciseTagMapper;
    this.exerciseTagMapMapper = exerciseTagMapMapper;
  }

  public Page<Exercise> listExercises(
    String keyword,
    List<Long> tagIds,
    String primaryMuscle,
    Integer difficulty,
    String equipment,
    int page,
    int pageSize
  ) {
    LambdaQueryWrapper<Exercise> wrapper = new LambdaQueryWrapper<>();
    wrapper.eq(Exercise::getIsDeleted, 0);
    if (StringUtils.hasText(keyword)) {
      wrapper.like(Exercise::getName, keyword.trim());
    }
    if (StringUtils.hasText(primaryMuscle)) {
      wrapper.eq(Exercise::getPrimaryMuscle, primaryMuscle.trim());
    }
    if (difficulty != null) {
      wrapper.eq(Exercise::getDifficulty, difficulty);
    }
    if (StringUtils.hasText(equipment)) {
      wrapper.eq(Exercise::getEquipment, equipment.trim());
    }
    if (tagIds != null && !tagIds.isEmpty()) {
      List<ExerciseTagMap> maps =
        exerciseTagMapMapper.selectList(
          new LambdaQueryWrapper<ExerciseTagMap>()
            .in(ExerciseTagMap::getTagId, tagIds)
            .eq(ExerciseTagMap::getIsDeleted, 0)
        );
      Set<Long> exerciseIds =
        maps.stream()
          .map(ExerciseTagMap::getExerciseId)
          .filter(Objects::nonNull)
          .collect(Collectors.toSet());
      if (exerciseIds.isEmpty()) {
        Page<Exercise> empty = new Page<>(page, pageSize);
        empty.setRecords(Collections.emptyList());
        empty.setTotal(0);
        return empty;
      }
      wrapper.in(Exercise::getId, exerciseIds);
    }
    wrapper.orderByDesc(Exercise::getId);
    return exerciseMapper.selectPage(new Page<>(page, pageSize), wrapper);
  }

  public Exercise getExercise(Long id) {
    return exerciseMapper.selectOne(
      new LambdaQueryWrapper<Exercise>()
        .eq(Exercise::getId, id)
        .eq(Exercise::getIsDeleted, 0)
    );
  }

  public List<ExerciseMedia> listMedia(Long exerciseId) {
    return exerciseMediaMapper.selectList(
      new LambdaQueryWrapper<ExerciseMedia>()
        .eq(ExerciseMedia::getExerciseId, exerciseId)
        .eq(ExerciseMedia::getIsDeleted, 0)
        .orderByDesc(ExerciseMedia::getCoverFlag)
        .orderByDesc(ExerciseMedia::getId)
    );
  }

  public Map<Long, List<ExerciseMedia>> fetchMediaByExerciseIds(List<Long> exerciseIds) {
    if (exerciseIds == null || exerciseIds.isEmpty()) {
      return Collections.emptyMap();
    }
    List<ExerciseMedia> mediaList = exerciseMediaMapper.selectActiveByExerciseIds(exerciseIds);
    if (mediaList.isEmpty()) {
      return Collections.emptyMap();
    }
    Map<Long, List<ExerciseMedia>> grouped = new HashMap<>();
    for (ExerciseMedia media : mediaList) {
      if (media == null || media.getExerciseId() == null) {
        continue;
      }
      grouped.computeIfAbsent(media.getExerciseId(), key -> new java.util.ArrayList<>()).add(media);
    }
    return grouped;
  }

  public List<ExerciseTag> listTags() {
    return exerciseTagMapper.selectList(
      new LambdaQueryWrapper<ExerciseTag>()
        .eq(ExerciseTag::getIsDeleted, 0)
        .orderByAsc(ExerciseTag::getTagType)
        .orderByAsc(ExerciseTag::getTagName)
    );
  }

  public List<ExerciseTag> listTagsByExercise(Long exerciseId) {
    if (exerciseId == null) {
      return Collections.emptyList();
    }

    List<ExerciseTagMap> maps =
      exerciseTagMapMapper.selectList(
        new LambdaQueryWrapper<ExerciseTagMap>()
          .eq(ExerciseTagMap::getExerciseId, exerciseId)
          .eq(ExerciseTagMap::getIsDeleted, 0)
      );
    if (maps.isEmpty()) {
      return Collections.emptyList();
    }

    Set<Long> tagIds =
      maps.stream()
        .map(ExerciseTagMap::getTagId)
        .filter(Objects::nonNull)
        .collect(Collectors.toSet());
    if (tagIds.isEmpty()) {
      return Collections.emptyList();
    }

    return exerciseTagMapper.selectList(
      new LambdaQueryWrapper<ExerciseTag>()
        .in(ExerciseTag::getId, tagIds)
        .eq(ExerciseTag::getIsDeleted, 0)
        .orderByAsc(ExerciseTag::getTagType)
        .orderByAsc(ExerciseTag::getTagName)
    );
  }

  public Exercise createCustomExercise(
    String name,
    String primaryMuscle,
    String equipment,
    Integer difficulty,
    String description,
    String coverUrl,
    String videoUrl
  ) {
    String normalizedName = normalizeRequired(name, "Exercise name is required.", 128);
    String normalizedPrimaryMuscle = normalizeOptional(primaryMuscle, 64, "General");
    String normalizedEquipment = normalizeOptional(equipment, 64, "Bodyweight");
    String normalizedDescription = normalizeOptional(description, 2000, "");
    Integer normalizedDifficulty = difficulty == null ? 2 : difficulty;
    if (normalizedDifficulty < 1 || normalizedDifficulty > 3) {
      throw new IllegalArgumentException("Difficulty must be between 1 and 3.");
    }

    LocalDateTime now = LocalDateTime.now();
    Exercise exercise = new Exercise();
    exercise.setName(normalizedName);
    exercise.setPrimaryMuscle(normalizedPrimaryMuscle);
    exercise.setEquipment(normalizedEquipment);
    exercise.setDifficulty(normalizedDifficulty);
    exercise.setDescription(normalizedDescription);
    exercise.setStatus(1);
    exercise.setIsDeleted(0);
    exercise.setCreateTime(now);
    exercise.setUpdateTime(now);
    exerciseMapper.insert(exercise);

    Long exerciseId = exercise.getId();
    if (exerciseId == null || exerciseId <= 0) {
      throw new IllegalStateException("Failed to create exercise.");
    }

    String normalizedCoverUrl = normalizeOptional(coverUrl, 255, "");
    String normalizedVideoUrl = normalizeOptional(videoUrl, 255, "");
    if (StringUtils.hasText(normalizedCoverUrl)) {
      insertMedia(exerciseId, "image", normalizedCoverUrl, 1, now);
    }
    if (StringUtils.hasText(normalizedVideoUrl)) {
      insertMedia(exerciseId, "video", normalizedVideoUrl, 0, now);
    }

    return exercise;
  }

  private void insertMedia(
    Long exerciseId,
    String mediaType,
    String url,
    Integer coverFlag,
    LocalDateTime now
  ) {
    ExerciseMedia media = new ExerciseMedia();
    media.setExerciseId(exerciseId);
    media.setMediaType(mediaType);
    media.setUrl(url);
    media.setCoverFlag(coverFlag);
    media.setCreateTime(now);
    media.setUpdateTime(now);
    media.setIsDeleted(0);
    exerciseMediaMapper.insert(media);
  }

  public String resolveCoverUrl(List<ExerciseMedia> media) {
    if (media == null || media.isEmpty()) {
      return null;
    }
    Optional<ExerciseMedia> cover =
      media.stream()
        .filter(item -> item.getCoverFlag() != null && item.getCoverFlag() == 1)
        .findFirst();
    if (cover.isPresent()) {
      return cover.get().getUrl();
    }
    return media.get(0).getUrl();
  }

  public String resolveCoverUrl(Long exerciseId) {
    if (exerciseId == null) {
      return null;
    }
    return resolveCoverUrl(listMedia(exerciseId));
  }

  private String normalizeRequired(String value, String errorMessage, int maxLength) {
    String normalized = normalizeOptional(value, maxLength, "");
    if (!StringUtils.hasText(normalized)) {
      throw new IllegalArgumentException(errorMessage);
    }
    return normalized;
  }

  private String normalizeOptional(String value, int maxLength, String fallback) {
    if (!StringUtils.hasText(value)) {
      return fallback;
    }
    String normalized = value.trim();
    if (normalized.length() > maxLength) {
      throw new IllegalArgumentException("Input too long.");
    }
    return normalized;
  }
}
