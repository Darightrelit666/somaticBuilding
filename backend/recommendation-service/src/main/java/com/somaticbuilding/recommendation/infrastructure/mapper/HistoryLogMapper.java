package com.somaticbuilding.recommendation.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.recommendation.domain.HistoryLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface HistoryLogMapper extends BaseMapper<HistoryLog> {}
