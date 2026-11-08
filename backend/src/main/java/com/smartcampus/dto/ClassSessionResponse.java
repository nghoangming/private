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
        OffsetDateTime createdAt,
        String calendarStatus,
        Long teacherId
) {
    public ClassSessionResponse(Long id, Long bookingId, String courseCode, String title,
                                Long roomId, OffsetDateTime startTime, OffsetDateTime endTime,
                                OffsetDateTime createdAt) {
        this(id, bookingId, courseCode, title, roomId, startTime, endTime, createdAt, "SCHEDULED", null);
    }
}
