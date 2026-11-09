package com.smartcampus.controller;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final JdbcTemplate jdbc;
    public NotificationController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Notification(Long id, String title, String message, String type,
                               Long bookingId, boolean read, OffsetDateTime createdAt) { }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Notification> list(@RequestAttribute("authenticatedUserId") Long userId) {
        return jdbc.query("""
            SELECT notification_id,title,message,notification_type,related_booking_id,is_read,created_at
            FROM notifications WHERE user_id=? ORDER BY created_at DESC,notification_id DESC
            """, (rs,n) -> new Notification(rs.getLong(1),rs.getString(2),rs.getString(3),
                rs.getString(4),rs.getObject(5,Long.class),rs.getBoolean(6),
                rs.getObject(7,OffsetDateTime.class)),userId);
    }

    @PatchMapping("/{id}/read")
    @Transactional
    public Notification markRead(@PathVariable Long id,
                                 @RequestAttribute("authenticatedUserId") Long userId) {
        List<Notification> rows = jdbc.query("""
            UPDATE notifications SET is_read=TRUE WHERE notification_id=? AND user_id=?
            RETURNING notification_id,title,message,notification_type,related_booking_id,is_read,created_at
            """, (rs,n) -> new Notification(rs.getLong(1),rs.getString(2),rs.getString(3),
                rs.getString(4),rs.getObject(5,Long.class),rs.getBoolean(6),
                rs.getObject(7,OffsetDateTime.class)),id,userId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification not found");
        return rows.getFirst();
    }
}
