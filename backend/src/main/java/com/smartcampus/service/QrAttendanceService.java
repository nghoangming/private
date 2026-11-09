package com.smartcampus.service;

import com.smartcampus.controller.QrAttendanceController.AttendanceResponse;
import com.smartcampus.controller.QrAttendanceController.CheckInRequest;
import com.smartcampus.controller.QrAttendanceController.QrResponse;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class QrAttendanceService {
    private final JdbcTemplate jdbc;
    public QrAttendanceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private void role(Long userId, String role) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM user_roles ur JOIN roles r USING(role_id) WHERE ur.user_id=? AND r.role_name=?",
                Integer.class, userId, role);
        if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Role not allowed");
    }

    @Transactional
    public QrResponse generate(Long sessionId, Long teacherId) {
        role(teacherId, "TEACHER");
        return jdbc.queryForObject("SELECT class_session_id,manual_code,expires_at FROM issue_checkin_challenge(?,?)",
                (rs,n) -> new QrResponse(rs.getLong(1),rs.getString(2),rs.getObject(3,OffsetDateTime.class)),
                sessionId,teacherId);
    }

    @Transactional
    public AttendanceResponse checkIn(CheckInRequest request, Long studentId) {
        role(studentId, "STUDENT");
        if (request.classSessionId() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cần mã buổi học để điểm danh.");
        Long checkinId = jdbc.queryForObject("SELECT submit_class_checkin(?,?,'MANUAL_CODE',?)", Long.class,
                request.classSessionId(),studentId,request.qrCode().trim());
        return jdbc.queryForObject("""
            SELECT a.attendance_id,a.class_session_id,a.user_id,sr.seat_id,s.seat_number,
                   a.attendance_status,a.check_in_at,u.full_name
            FROM attendance a JOIN seat_reservations sr ON sr.seat_reservation_id=a.seat_reservation_id
            JOIN seats s ON s.seat_id=sr.seat_id JOIN users u ON u.user_id=a.user_id
            WHERE a.checkin_id=?
            """, (rs,n) -> new AttendanceResponse(rs.getLong(1),rs.getLong(2),rs.getLong(3),
                rs.getLong(4),rs.getInt(5),rs.getString(6),rs.getObject(7,OffsetDateTime.class),rs.getString(8)),checkinId);
    }

    @Transactional
    public void cancel(Long attendanceId, Long teacherId) {
        role(teacherId, "TEACHER");
        List<long[]> rows = jdbc.query("SELECT class_session_id,user_id FROM attendance WHERE attendance_id=?",
                (rs,n) -> new long[] {rs.getLong(1),rs.getLong(2)},attendanceId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Attendance not found");
        jdbc.queryForObject("SELECT attendance_id FROM revoke_class_checkin(?,?,?)",Long.class,
                rows.getFirst()[0],rows.getFirst()[1],teacherId);
    }

    @Transactional(readOnly = true)
    public List<AttendanceResponse> list(Long sessionId, Long teacherId) {
        role(teacherId, "TEACHER");
        Long owner = jdbc.queryForObject("SELECT b.user_id FROM class_sessions cs JOIN bookings b USING(booking_id) WHERE cs.class_session_id=?",
                Long.class,sessionId);
        if (!teacherId.equals(owner)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your class session");
        return jdbc.query("""
            SELECT a.attendance_id,sr.user_id,sr.seat_id,s.seat_number,a.attendance_status,a.check_in_at,u.full_name
            FROM seat_reservations sr JOIN seats s ON s.seat_id=sr.seat_id JOIN users u ON u.user_id=sr.user_id
            LEFT JOIN attendance a ON a.class_session_id=sr.class_session_id AND a.user_id=sr.user_id
            WHERE sr.class_session_id=? AND sr.status='CONFIRMED' ORDER BY s.seat_number
            """, (rs,n) -> new AttendanceResponse(rs.getObject(1,Long.class),sessionId,rs.getLong(2),
                rs.getLong(3),rs.getInt(4),rs.getString(5)==null?"NOT_CHECKED_IN":rs.getString(5),
                rs.getObject(6,OffsetDateTime.class),rs.getString(7)),sessionId);
    }

    @Transactional(readOnly = true)
    public List<Long> checkedInSessions(Long studentId) {
        role(studentId, "STUDENT");
        return jdbc.query("SELECT class_session_id FROM attendance WHERE user_id=? AND attendance_status='PRESENT'",
                (rs,n) -> rs.getLong(1),studentId);
    }
}
