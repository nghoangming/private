package com.smartcampus.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record RoomWriteRequest(
        @NotBlank String code,
        @NotBlank String name,
        String location,
        @NotBlank String status,
        @NotBlank String type,
        @Min(1) @Max(10000) int capacity
) { }
