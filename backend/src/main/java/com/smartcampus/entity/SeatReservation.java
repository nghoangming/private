package com.smartcampus.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "seat_reservations")
public class SeatReservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "seat_reservation_id")
    private Long id;

    @Column(name = "class_session_id", nullable = false)
    private Long classSessionId;

    @Column(name = "seat_id", nullable = false)
    private Long seatId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "room_id", nullable = false)
    private Long roomId;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    protected SeatReservation() { }

    private SeatReservation(Long classSessionId, Long seatId, Long userId, Long roomId) {
        this.classSessionId = classSessionId;
        this.seatId = seatId;
        this.userId = userId;
        this.roomId = roomId;
        this.status = "CONFIRMED";
        this.createdAt = OffsetDateTime.now();
    }

    public static SeatReservation create(Long classSessionId, Long seatId, Long userId, Long roomId) {
        return new SeatReservation(classSessionId, seatId, userId, roomId);
    }

    public void cancel() { status = "CANCELLED"; }

    public Long getId() { return id; }
    public Long getClassSessionId() { return classSessionId; }
    public Long getSeatId() { return seatId; }
    public Long getUserId() { return userId; }
    public Long getRoomId() { return roomId; }
    public String getStatus() { return status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
