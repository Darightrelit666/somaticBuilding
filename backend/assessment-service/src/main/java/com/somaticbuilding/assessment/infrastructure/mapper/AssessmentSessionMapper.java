package com.somaticbuilding.assessment.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.assessment.domain.AssessmentSession;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AssessmentSessionMapper extends BaseMapper<AssessmentSession> {}
