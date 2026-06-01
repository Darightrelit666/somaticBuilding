package com.somaticbuilding.exercise.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.somaticbuilding.exercise.interfaces.dto.ExerciseListResponse;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ExerciseListCacheService {
  private static final String KEY_PREFIX = "exercise:list:v1:";
  private static final Logger log = LoggerFactory.getLogger(ExerciseListCacheService.class);

  private final StringRedisTemplate redisTemplate;
  private final ObjectMapper objectMapper;
  private final MeterRegistry meterRegistry;
  private final boolean enabled;
  private final Duration ttl;

  public ExerciseListCacheService(
    @Autowired(required = false) StringRedisTemplate redisTemplate,
    ObjectMapper objectMapper,
    MeterRegistry meterRegistry,
    @Value("${exercise.performance.list-cache-enabled:true}") boolean enabled,
    @Value("${exercise.performance.list-cache-ttl-seconds:90}") long ttlSeconds
  ) {
    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
    this.meterRegistry = meterRegistry;
    this.enabled = enabled;
    this.ttl = Duration.ofSeconds(Math.max(ttlSeconds, 10));
  }

  public String buildKey(
    String keyword,
    List<Long> tagIds,
    String primaryMuscle,
    Integer difficulty,
    String equipment,
    Integer page,
    Integer pageSize
  ) {
    String tags =
      tagIds == null
        ? ""
        : tagIds.stream()
          .sorted(Comparator.naturalOrder())
          .map(String::valueOf)
          .collect(Collectors.joining(","));
    String raw =
      normalize(keyword) + "|" +
      tags + "|" +
      normalize(primaryMuscle) + "|" +
      (difficulty == null ? "" : difficulty) + "|" +
      normalize(equipment) + "|" +
      (page == null ? 1 : page) + "|" +
      (pageSize == null ? 20 : pageSize);
    return DigestUtils.md5DigestAsHex(raw.getBytes(StandardCharsets.UTF_8));
  }

  public ExerciseListResponse get(String key) {
    if (!enabled) {
      incrementRequest("disabled");
      return null;
    }
    if (redisTemplate == null) {
      incrementRequest("no_client");
      return null;
    }
    try {
      String payload = redisTemplate.opsForValue().get(KEY_PREFIX + key);
      if (payload == null || payload.isBlank()) {
        incrementRequest("miss");
        return null;
      }
      ExerciseListResponse response = objectMapper.readValue(payload, ExerciseListResponse.class);
      incrementRequest("hit");
      return response;
    } catch (Exception ex) {
      incrementRequest("error");
      log.warn("exercise list cache read failed: {}", ex.getMessage());
      return null;
    }
  }

  public void put(String key, ExerciseListResponse response) {
    if (!enabled || response == null) {
      incrementWrite("skipped");
      return;
    }
    if (redisTemplate == null) {
      incrementWrite("no_client");
      return;
    }
    try {
      String payload = objectMapper.writeValueAsString(response);
      redisTemplate.opsForValue().set(KEY_PREFIX + key, payload, ttl);
      meterRegistry.summary("exercise.list.cache.payload.bytes").record(payload.getBytes(StandardCharsets.UTF_8).length);
      incrementWrite("success");
    } catch (Exception ex) {
      incrementWrite("error");
      log.warn("exercise list cache write failed: {}", ex.getMessage());
    }
  }

  private String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase();
  }

  private void incrementRequest(String result) {
    meterRegistry.counter("exercise.list.cache.requests", "result", result).increment();
  }

  private void incrementWrite(String result) {
    meterRegistry.counter("exercise.list.cache.writes", "result", result).increment();
  }
}
