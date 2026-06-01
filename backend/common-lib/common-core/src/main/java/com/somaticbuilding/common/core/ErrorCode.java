package com.somaticbuilding.common.core;

public enum ErrorCode {
  SUCCESS(200),
  PARAM_ERROR(400),
  UNAUTHORIZED(401),
  FORBIDDEN(403),
  SERVER_ERROR(500);

  private final int code;

  ErrorCode(int code) {
    this.code = code;
  }

  public int getCode() {
    return code;
  }
}
