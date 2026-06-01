package com.somaticbuilding.workout.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.workout.domain.WorkoutBlock;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface WorkoutBlockMapper extends BaseMapper<WorkoutBlock> {}
