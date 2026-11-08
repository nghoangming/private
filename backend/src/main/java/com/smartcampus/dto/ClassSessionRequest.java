package com.smartcampus.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ClassSessionRequest(
        @NotNull Long bookingId,
        @NotBlank String courseCode,
        @NotBlank String title,
        Boolean makeup
) {
    public ClassSessionRequest(Long bookingId, String courseCode, String title) {
        this(bookingId, courseCode, title, false);
    }
}
