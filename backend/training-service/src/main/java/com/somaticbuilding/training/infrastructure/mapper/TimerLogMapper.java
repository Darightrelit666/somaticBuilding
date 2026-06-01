package com.somaticbuilding.training.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.training.domain.TimerLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TimerLogMapper extends BaseMapper<TimerLog> {}
