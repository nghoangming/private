package com.smartcampus.dto;

import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

public record ReservationRequest(
        @NotNull(message = "roomId is required")
        Long roomId,

        Long classSessionId,

        @NotNull(message = "startTime is required")
        OffsetDateTime startTime,

        @NotNull(message = "endTime is required")
        OffsetDateTime endTime,

        String note
) {
}
