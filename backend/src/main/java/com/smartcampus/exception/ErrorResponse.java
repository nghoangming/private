package com.smartcampus.exception;

public record ErrorResponse(
        int status,
        String message
) {
}