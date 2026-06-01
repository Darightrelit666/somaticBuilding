package com.somaticbuilding.exercise.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.exercise.domain.ExerciseMedia;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Mapper;

import java.util.Collection;
import java.util.List;

@Mapper
public interface ExerciseMediaMapper extends BaseMapper<ExerciseMedia> {
  @Select({
    "<script>",
    "SELECT id, exercise_id, media_type, url, cover_flag, create_time, update_time, is_deleted",
    "FROM exercise_media",
    "WHERE is_deleted = 0",
    "  AND exercise_id IN",
    "<foreach collection='exerciseIds' item='exerciseId' open='(' separator=',' close=')'>",
    "  #{exerciseId}",
    "</foreach>",
    "ORDER BY exercise_id ASC, cover_flag DESC, id DESC",
    "</script>"
  })
  List<ExerciseMedia> selectActiveByExerciseIds(@Param("exerciseIds") Collection<Long> exerciseIds);
}
