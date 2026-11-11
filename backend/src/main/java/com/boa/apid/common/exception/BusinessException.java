package com.boa.apid.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception representing a predictable business rule violation across APID modules.
 */
public class BusinessException extends RuntimeException {

    private final String errorCode;
    private final HttpStatus status;

    public BusinessException(String errorCode, String message, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public BusinessException(String errorCode, String message) {
        this(errorCode, message, HttpStatus.BAD_REQUEST);
    }

    public String getErrorCode() {
        return errorCode;
    }

    public HttpStatus getStatus() {
        return status;
    }
}

