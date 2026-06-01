package com.somaticbuilding.exercise.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.exercise.domain.ExerciseTag;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ExerciseTagMapper extends BaseMapper<ExerciseTag> {}
