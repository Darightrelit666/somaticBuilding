package com.somaticbuilding.auth.infrastructure.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.somaticbuilding.auth.domain.UserOauth;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserOauthMapper extends BaseMapper<UserOauth> {}
