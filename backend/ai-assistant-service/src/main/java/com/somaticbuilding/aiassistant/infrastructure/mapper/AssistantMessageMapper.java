package com.somaticbuilding.aiassistant.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.aiassistant.domain.AssistantMessage;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AssistantMessageMapper extends BaseMapper<AssistantMessage> {}
