package com.smartcampus.service;

import com.smartcampus.controller.QrAttendanceController.AttendanceResponse;
import com.smartcampus.controller.QrAttendanceController.CheckInRequest;
import com.smartcampus.controller.QrAttendanceController.QrResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class QrAttendanceService {
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    public QrAttendanceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private record Session(Long id, Long bookingId, Long teacherId, OffsetDateTime start, OffsetDateTime end, String bookingStatus) { }
    private Session session(Long id) {
        List<Session> rows = jdbc.query("""
            SELECT cs.class_session_id, cs.booking_id, b.user_id, cs.start_time, cs.end_time, b.status
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id = ?
            """, (rs, n) -> new Session(rs.getLong(1), rs.getLong(2), rs.getLong(3),
                rs.getObject(4, OffsetDateTime.class), rs.getObject(5, OffsetDateTime.class), rs.getString(6)), id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Class session not found");
        return rows.getFirst();
    }
    private void role(Long userId, String role) {
        Integer count = jdbc.queryForObject("""
            SELECT count(*) FROM user_roles ur JOIN roles r ON r.role_id = ur.role_id
            WHERE ur.user_id = ? AND r.role_name = ?
            """, Integer.class, userId, role);
        if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
    }
    private void open(Session session, OffsetDateTime now) {
        if (!"CONFIRMED".equals(session.bookingStatus()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Buổi học chưa được duyệt; chưa thể tạo hoặc quét QR.");
        if (now.isBefore(session.start().plusMinutes(5)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chỉ có thể tạo hoặc quét QR từ phút thứ 5 sau khi bắt đầu buổi học.");
        if (!now.isBefore(windowEnd(session)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Đã hết 15 phút điểm danh của buổi học.");
    }
    private OffsetDateTime windowEnd(Session session) {
        OffsetDateTime limit = session.start().plusMinutes(20);
        return limit.isBefore(session.end()) ? limit : session.end();
    }

    @Transactional
    public QrResponse generate(Long sessionId, Long teacherId) {
        role(teacherId, "TEACHER");
        Session session = session(sessionId);
        if (!session.teacherId().equals(teacherId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your class session");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        open(session, now);
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        OffsetDateTime expiresAt = now.plusMinutes(2).isBefore(windowEnd(session)) ? now.plusMinutes(2) : windowEnd(session);
        jdbc.update("DELETE FROM class_session_qr_tokens WHERE class_session_id = ?", sessionId);
        jdbc.update("INSERT INTO class_session_qr_tokens(class_session_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?)",
                sessionId, hash(token), expiresAt, teacherId);
        return new QrResponse(sessionId, token, expiresAt);
    }

    @Transactional
    public AttendanceResponse checkIn(CheckInRequest request, Long studentId) {
        role(studentId, "STUDENT");
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        List<Long> ids = jdbc.query("SELECT class_session_id FROM class_session_qr_tokens WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP",
                (rs, n) -> rs.getLong(1), hash(request.qrCode().trim()));
        if (ids.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "QR code expired or invalid");
        Long sessionId = ids.getFirst();
        if (request.classSessionId() != null && !request.classSessionId().equals(sessionId))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "QR code belongs to another class session");
        Session session = session(sessionId); open(session, now);
        List<long[]> seats = jdbc.query("""
            SELECT sr.seat_id, s.seat_number FROM seat_reservations sr JOIN seats s ON s.seat_id = sr.seat_id
            WHERE sr.class_session_id = ? AND sr.user_id = ? AND sr.status = 'CONFIRMED'
            """, (rs, n) -> new long[] { rs.getLong(1), rs.getLong(2) }, sessionId, studentId);
        if (seats.isEmpty()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Reserve a seat before check-in");
        Integer existing = jdbc.queryForObject("SELECT count(*) FROM attendance WHERE booking_id = ? AND user_id = ? AND attendance_status = 'PRESENT'", Integer.class, session.bookingId(), studentId);
        if (existing != null && existing > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "Already checked in");
        try {
            Long checkinId = jdbc.queryForObject("""
                INSERT INTO checkins(booking_id, user_id, method, status) VALUES (?, ?, 'QR', 'SUCCESS') RETURNING checkin_id
                """, Long.class, session.bookingId(), studentId);
            Long attendanceId = jdbc.queryForObject("""
                INSERT INTO attendance(booking_id, user_id, checkin_id, attendance_status, check_in_at)
                VALUES (?, ?, ?, 'PRESENT', ?) RETURNING attendance_id
                """, Long.class, session.bookingId(), studentId, checkinId, now);
            return new AttendanceResponse(attendanceId, sessionId, studentId, seats.getFirst()[0],
                    (int) seats.getFirst()[1], "PRESENT", now);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already checked in", ex);
        }
    }

    @Transactional
    public void cancel(Long attendanceId, Long teacherId) {
        role(teacherId, "TEACHER");
        List<Long> checkinIds = jdbc.query("""
            UPDATE attendance a SET attendance_status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, cancelled_by = ?
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE a.attendance_id = ? AND a.booking_id = cs.booking_id AND b.user_id = ?
              AND a.attendance_status = 'PRESENT'
            RETURNING a.checkin_id
            """, (rs, n) -> rs.getLong(1), teacherId, attendanceId, teacherId);
        if (checkinIds.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy lượt điểm danh đang có hiệu lực của lớp bạn.");
        jdbc.update("UPDATE checkins SET status = 'CANCELLED' WHERE checkin_id = ?", checkinIds.getFirst());
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> list(Long sessionId, Long teacherId) {
        role(teacherId, "TEACHER");
        Session session = session(sessionId);
        if (!session.teacherId().equals(teacherId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your class session");
        return jdbc.query("""
            SELECT a.attendance_id, sr.user_id, sr.seat_id, s.seat_number, a.attendance_status, a.check_in_at
            FROM seat_reservations sr JOIN seats s ON s.seat_id = sr.seat_id
            LEFT JOIN attendance a ON a.booking_id = ? AND a.user_id = sr.user_id AND a.attendance_status = 'PRESENT'
            WHERE sr.class_session_id = ? AND sr.status = 'CONFIRMED'
            ORDER BY s.seat_number
            """, (rs, n) -> new AttendanceResponse(rs.getObject(1, Long.class), sessionId, rs.getLong(2), rs.getLong(3),
                rs.getInt(4), rs.getString(5) == null ? "NOT_CHECKED_IN" : rs.getString(5),
                rs.getObject(6, OffsetDateTime.class)), session.bookingId(), sessionId);
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }
}
