package com.smartcampus.service;

import com.smartcampus.dto.RoomResponse;
import com.smartcampus.dto.RoomWriteRequest;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RoomWriteService {
    private final JdbcTemplate jdbc;

    public RoomWriteService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public RoomResponse create(RoomWriteRequest request, Long userId) {
        admin(userId);
        validate(request);
        try {
            Long id = jdbc.queryForObject("""
                INSERT INTO rooms (room_code, name, location, status, type)
                VALUES (?, ?, ?, ?, ?) RETURNING room_id
                """, Long.class, request.code().trim().toUpperCase(), request.name().trim(),
                    location(request), request.status(), request.type());
            jdbc.update("""
                INSERT INTO seats (room_id, seat_number, status)
                SELECT ?, n, 'AVAILABLE' FROM generate_series(1, ?) n
                """, id, request.capacity());
            return read(id);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Mã phòng đã tồn tại hoặc dữ liệu phòng không hợp lệ.", ex);
        }
    }

    @Transactional
    public RoomResponse update(Long id, RoomWriteRequest request, Long userId) {
        admin(userId);
        validate(request);
        List<String> types = jdbc.query("SELECT type FROM rooms WHERE room_id = ? FOR UPDATE", (rs, n) -> rs.getString(1), id);
        if (types.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy phòng.");
        if (!types.getFirst().equals(request.type())) {
            Integer bookings = jdbc.queryForObject("SELECT count(*) FROM bookings WHERE room_id = ?", Integer.class, id);
            if (bookings != null && bookings > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Phòng đã có lịch đặt, không thể đổi loại phòng.");
        }
        Integer oldCapacity = jdbc.queryForObject("SELECT COALESCE(MAX(seat_number), 0) FROM seats WHERE room_id = ?", Integer.class, id);
        int old = oldCapacity == null ? 0 : oldCapacity;
        try {
            if (request.capacity() < old) {
                jdbc.update("DELETE FROM seats WHERE room_id = ? AND seat_number > ?", id, request.capacity());
            } else if (request.capacity() > old) {
                jdbc.update("""
                    INSERT INTO seats (room_id, seat_number, status)
                    SELECT ?, n, 'AVAILABLE' FROM generate_series(?, ?) n
                    WHERE NOT EXISTS (SELECT 1 FROM seats WHERE room_id = ? AND seat_number = n)
                    """, id, old + 1, request.capacity(), id);
            }
            jdbc.update("UPDATE rooms SET room_code = ?, name = ?, location = ?, status = ?, type = ? WHERE room_id = ?",
                    request.code().trim().toUpperCase(), request.name().trim(), location(request),
                    request.status(), request.type(), id);
            return read(id);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Không thể giảm sức chứa khi ghế đã có lịch sử đặt, hoặc mã phòng bị trùng.", ex);
        }
    }

    private RoomResponse read(Long id) {
        return jdbc.queryForObject("""
            SELECT r.room_id, r.room_code, r.name, r.location, r.status, r.type,
                   (SELECT count(*) FROM seats s WHERE s.room_id = r.room_id) AS capacity
            FROM rooms r WHERE r.room_id = ?
            """, (rs, n) -> new RoomResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getString(5), rs.getString(6), rs.getInt(7)), id);
    }

    private void admin(Long userId) {
        Integer count = jdbc.queryForObject("""
            SELECT count(*) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = ? AND r.role_name = 'ADMIN'
            """, Integer.class, userId);
        if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chỉ quản trị viên được sửa phòng.");
    }

    private void validate(RoomWriteRequest request) {
        if (!List.of("THEORY", "LAB", "STUDY").contains(request.type())
                || !List.of("ACTIVE", "MAINTENANCE").contains(request.status())
                || request.code().trim().length() > 20 || request.name().trim().length() > 100
                || location(request).length() > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thông tin phòng không hợp lệ.");
    }

    private String location(RoomWriteRequest request) { return request.location() == null ? "" : request.location().trim(); }
}
