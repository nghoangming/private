package com.smartcampus.controller;

import com.smartcampus.auth.AccessService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/absence-requests")
public class AbsenceRequestController {
    private final JdbcTemplate jdbc;
    private final AccessService access;
    public AbsenceRequestController(JdbcTemplate jdbc, AccessService access) {
        this.jdbc = jdbc;
        this.access = access;
    }

    public record Reason(@NotBlank String reason) { }
    public record Decision(boolean approve, String note) { }
    public record Absence(Long id, Long userId, Long classSessionId, String type, String reason,
                          String status, Long reviewedBy, OffsetDateTime createdAt, OffsetDateTime reviewedAt) { }

    private Absence read(Long id) {
        return jdbc.queryForObject("""
            SELECT absence_request_id,user_id,class_session_id,request_type,reason,status,
                   reviewed_by,created_at,reviewed_at FROM absence_requests WHERE absence_request_id=?
            """, (rs,n) -> new Absence(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getString(4),
                rs.getString(5),rs.getString(6),rs.getObject(7,Long.class),
                rs.getObject(8,OffsetDateTime.class),rs.getObject(9,OffsetDateTime.class)),id);
    }

    @PostMapping("/class-sessions/{sessionId}")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Absence request(@PathVariable Long sessionId, @Valid @RequestBody Reason body,
                           @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId,"STUDENT");
        Long id = jdbc.queryForObject("SELECT absence_request_id FROM request_student_absence(?,?,?)",
                Long.class,sessionId,userId,body.reason());
        return read(id);
    }

    @PatchMapping("/{id}")
    @Transactional
    public Absence review(@PathVariable Long id, @RequestBody Decision body,
                          @RequestAttribute("authenticatedUserId") Long userId) {
        access.requireRole(userId,"TEACHER");
        Long reviewed = jdbc.queryForObject("SELECT absence_request_id FROM review_student_absence(?,?,?,?)",
                Long.class,id,userId,body.approve(),body.note());
        return read(reviewed);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Absence> list(@RequestAttribute("authenticatedUserId") Long userId) {
        return jdbc.query("""
            SELECT ar.absence_request_id,ar.user_id,ar.class_session_id,ar.request_type,ar.reason,
                   ar.status,ar.reviewed_by,ar.created_at,ar.reviewed_at
            FROM absence_requests ar
            JOIN class_sessions cs ON cs.class_session_id=ar.class_session_id
            JOIN bookings b ON b.booking_id=cs.booking_id
            WHERE ar.user_id=? OR (ar.request_type='STUDENT' AND b.user_id=?)
              OR (ar.request_type='TEACHER' AND EXISTS (
                SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
                WHERE ur.user_id=? AND r.role_name='ADMIN'))
            ORDER BY ar.created_at DESC
            """, (rs,n) -> new Absence(rs.getLong(1),rs.getLong(2),rs.getLong(3),rs.getString(4),
                rs.getString(5),rs.getString(6),rs.getObject(7,Long.class),
                rs.getObject(8,OffsetDateTime.class),rs.getObject(9,OffsetDateTime.class)),
                userId,userId,userId);
    }
}
