package com.boa.apid.common.exception;

/**
 * Thrown when a requested entity or resource does not exist.
 */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}

