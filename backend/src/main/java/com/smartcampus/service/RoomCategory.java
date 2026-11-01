package com.smartcampus.service;

import com.smartcampus.entity.Room;

/** Categories of the rooms currently defined by the seed data. */
final class RoomCategory {

    private RoomCategory() { }

    static boolean matches(Room room, String category) {
        if (room == null || room.getType() == null) {
            return false;
        }
        return switch (category) {
            case "CLASSROOM" -> "THEORY".equals(room.getType()) || "LAB".equals(room.getType());
            case "STUDY" -> "STUDY".equals(room.getType());
            default -> false;
        };
    }
}
