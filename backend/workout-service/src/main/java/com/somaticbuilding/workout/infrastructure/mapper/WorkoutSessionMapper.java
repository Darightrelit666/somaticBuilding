package com.somaticbuilding.workout.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.workout.domain.WorkoutSession;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WorkoutSessionMapper extends BaseMapper<WorkoutSession> {}
