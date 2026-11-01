package com.smartcampus.dto;

public record RoomResponse(
        Long id,
        String code,
        String name,
        String location,
        String status,
        String type
) {
}
