package com.somaticbuilding.training.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.training.domain.TrainingRun;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TrainingRunMapper extends BaseMapper<TrainingRun> {}
