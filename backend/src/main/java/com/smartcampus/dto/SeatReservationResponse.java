package com.smartcampus.dto;

import java.time.OffsetDateTime;

public record SeatReservationResponse(
        Long id,
        Long classSessionId,
        Long seatId,
        Long userId,
        Long roomId,
        String status,
        OffsetDateTime createdAt
) { }
