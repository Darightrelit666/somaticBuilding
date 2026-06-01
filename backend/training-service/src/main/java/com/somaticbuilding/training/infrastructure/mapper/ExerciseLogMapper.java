package com.somaticbuilding.training.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.training.domain.ExerciseLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ExerciseLogMapper extends BaseMapper<ExerciseLog> {}
