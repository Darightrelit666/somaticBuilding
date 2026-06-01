package com.somaticbuilding.exercise.interfaces;

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

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ApiResponse<Void> handleValidation(MethodArgumentNotValidException ex) {
    log.warn("Validation failed: {}", ex.getMessage());
    return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), "Invalid parameters.");
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ApiResponse<Void> handleIllegalArgument(IllegalArgumentException ex) {
    log.warn("Business error: {}", ex.getMessage());
    return ApiResponse.failure(ErrorCode.PARAM_ERROR.getCode(), ex.getMessage());
  }

  @ExceptionHandler(Exception.class)
  public ApiResponse<Void> handleException(Exception ex) {
    log.error("Unhandled exception", ex);
    return ApiResponse.failure(ErrorCode.SERVER_ERROR.getCode(), "Server error.");
  }
}
