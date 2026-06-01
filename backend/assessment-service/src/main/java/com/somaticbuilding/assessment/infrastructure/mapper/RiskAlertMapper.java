package com.somaticbuilding.assessment.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.assessment.domain.RiskAlert;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RiskAlertMapper extends BaseMapper<RiskAlert> {}
