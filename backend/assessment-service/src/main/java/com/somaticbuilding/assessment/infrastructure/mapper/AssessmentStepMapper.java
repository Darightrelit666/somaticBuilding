package com.somaticbuilding.assessment.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.assessment.domain.AssessmentStep;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AssessmentStepMapper extends BaseMapper<AssessmentStep> {}
