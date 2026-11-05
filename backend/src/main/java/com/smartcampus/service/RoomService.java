package com.smartcampus.service;

import com.smartcampus.dto.RoomResponse;
import com.smartcampus.dto.RoomScheduleResponse;
import com.smartcampus.entity.Booking;
import com.smartcampus.entity.Room;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.repository.BookingRepository;
import com.smartcampus.repository.RoomRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;

@Service
public class RoomService {

    private static final ZoneId CAMPUS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final RoomRepository roomRepository;
    private final BookingRepository bookingRepository;
    private final JdbcTemplate jdbc;

    public RoomService(RoomRepository roomRepository, BookingRepository bookingRepository, JdbcTemplate jdbc) {
        this.roomRepository = roomRepository;
        this.bookingRepository = bookingRepository;
        this.jdbc = jdbc;
    }

    public List<RoomResponse> getRooms() {
        return roomRepository.findAll().stream().map(this::toResponse).toList();
    }

    public RoomResponse getRoomById(Long id) {
        return toResponse(findRoom(id));
    }

    public List<RoomScheduleResponse> getSchedule(Long roomId, LocalDate date) {
        findRoom(roomId);
        OffsetDateTime dayStart = date.atStartOfDay(CAMPUS_ZONE).toOffsetDateTime();
        OffsetDateTime dayEnd = date.plusDays(1).atStartOfDay(CAMPUS_ZONE).toOffsetDateTime();
        return bookingRepository.findOverlappingBookings(roomId, dayStart, dayEnd).stream()
                .map(this::toScheduleResponse)
                .toList();
    }

    public List<RoomResponse> getAvailableRooms(LocalDate date, LocalTime startTime, LocalTime endTime) {
        OffsetDateTime start = date.atTime(startTime).atZone(CAMPUS_ZONE).toOffsetDateTime();
        OffsetDateTime end = date.atTime(endTime).atZone(CAMPUS_ZONE).toOffsetDateTime();
        return roomRepository.findAll().stream()
                .filter(room -> "ACTIVE".equalsIgnoreCase(room.getStatus()))
                .filter(room -> bookingRepository.findOverlappingBookings(room.getId(), start, end).isEmpty())
                .map(this::toResponse)
                .toList();
    }

    private Room findRoom(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Room not found: " + id));
    }

    private RoomResponse toResponse(Room room) {
        Integer capacity = jdbc.queryForObject("SELECT count(*) FROM seats WHERE room_id = ?", Integer.class, room.getId());
        return new RoomResponse(room.getId(), room.getCode(), room.getName(), room.getLocation(), room.getStatus(), room.getType(), capacity);
    }

    private RoomScheduleResponse toScheduleResponse(Booking booking) {
        return new RoomScheduleResponse(booking.getId(), booking.getStartTime(), booking.getEndTime(), booking.getStatus());
    }
}
