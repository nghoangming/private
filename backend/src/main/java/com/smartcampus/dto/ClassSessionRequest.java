package com.smartcampus.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ClassSessionRequest(
        @NotNull Long bookingId,
        @NotBlank String courseCode,
        @NotBlank String title
) { }
