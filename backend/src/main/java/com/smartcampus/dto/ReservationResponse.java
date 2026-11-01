package com.smartcampus.dto;

import java.time.OffsetDateTime;

public record ReservationResponse(
        Long id,
        Long userId,
        Long roomId,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        String status,
        OffsetDateTime createdAt
) {
}
