package com.smartcampus.dto;

import java.time.OffsetDateTime;

public record RoomScheduleResponse(
        Long bookingId,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        String status
) {
}
