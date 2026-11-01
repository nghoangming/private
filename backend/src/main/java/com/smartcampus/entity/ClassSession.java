package com.smartcampus.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "class_sessions")
public class ClassSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "class_session_id")
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "course_code", nullable = false, length = 30)
    private String courseCode;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(name = "start_time", nullable = false)
    private OffsetDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private OffsetDateTime endTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected ClassSession() { }

    private ClassSession(Booking booking, String courseCode, String title) {
        this.bookingId = booking.getId();
        this.roomId = booking.getRoomId();
        this.startTime = booking.getStartTime();
        this.endTime = booking.getEndTime();
        this.courseCode = courseCode;
        this.title = title;
        this.createdAt = OffsetDateTime.now();
    }

    public static ClassSession create(Booking booking, String courseCode, String title) {
        return new ClassSession(booking, courseCode, title);
    }

    public Long getId() { return id; }
    public Long getBookingId() { return bookingId; }
    public String getCourseCode() { return courseCode; }
    public String getTitle() { return title; }
    public Long getRoomId() { return roomId; }
    public OffsetDateTime getStartTime() { return startTime; }
    public OffsetDateTime getEndTime() { return endTime; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
