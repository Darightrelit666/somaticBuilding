package com.somaticbuilding.exercise.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.exercise.domain.Exercise;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ExerciseMapper extends BaseMapper<Exercise> {}
