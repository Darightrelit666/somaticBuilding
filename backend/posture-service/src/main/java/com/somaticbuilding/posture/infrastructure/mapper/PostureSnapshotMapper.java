package com.somaticbuilding.posture.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.posture.domain.PostureSnapshot;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PostureSnapshotMapper extends BaseMapper<PostureSnapshot> {}
