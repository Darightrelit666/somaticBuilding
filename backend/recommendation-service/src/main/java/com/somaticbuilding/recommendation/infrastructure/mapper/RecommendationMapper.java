package com.somaticbuilding.recommendation.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.recommendation.domain.Recommendation;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface RecommendationMapper extends BaseMapper<Recommendation> {}
