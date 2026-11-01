package com.smartcampus.dto;

import java.time.OffsetDateTime;

public record ClassSessionResponse(
        Long id,
        Long bookingId,
        String courseCode,
        String title,
        Long roomId,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        OffsetDateTime createdAt
) { }
