package com.smartcampus.dto;

import jakarta.validation.constraints.NotNull;

public record SeatReservationRequest(
        @NotNull Long classSessionId,
        @NotNull Long seatId
) { }
