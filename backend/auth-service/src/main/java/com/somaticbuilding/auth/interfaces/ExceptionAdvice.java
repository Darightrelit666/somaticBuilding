package com.somaticbuilding.auth.interfaces;

import com.somaticbuilding.common.core.ApiResponse;
import com.somaticbuilding.common.core.ErrorCode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ExceptionAdvice {
  private static final Logger log = LoggerFactory.getLogger(ExceptionAdvice.class);

  @ExceptionHandler(IllegalArgumentException.class)
  public ApiResponse<Void> handleIllegalArgument(IllegalArgumentException ex) {
    return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), ex.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ApiResponse<Void> handleValidation(MethodArgumentNotValidException ex) {
    return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "参数错误");
  }

  @ExceptionHandler(Exception.class)
  public ApiResponse<Void> handleException(Exception ex) {
    log.error("异常", ex);
    return ApiResponse.failure(ErrorCode.SERVER_ERROR.getCode(), "服务器错误");
  }
}
