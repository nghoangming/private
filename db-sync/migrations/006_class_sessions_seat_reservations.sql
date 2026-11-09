BEGIN;
SET LOCAL lock_timeout = '10s';

-- A classroom session uses an existing booking as its room/time reservation.
-- Keeping one source of room occupancy also prevents session-vs-booking conflicts.
ALTER TABLE bookings
    ADD CONSTRAINT uq_bookings_id_room_time
        UNIQUE (booking_id, room_id, start_time, end_time);

CREATE TABLE class_sessions (
    class_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    course_code VARCHAR(30) NOT NULL,
    title VARCHAR(150) NOT NULL,
    room_id BIGINT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_kind VARCHAR(12) NOT NULL DEFAULT 'REGULAR' CHECK (session_kind IN ('REGULAR','MAKEUP')),
    CONSTRAINT uq_class_sessions_booking UNIQUE (booking_id),
    CONSTRAINT uq_class_sessions_id_room UNIQUE (class_session_id, room_id),
    CONSTRAINT chk_class_sessions_course_code CHECK (btrim(course_code) <> ''),
    CONSTRAINT chk_class_sessions_title CHECK (btrim(title) <> ''),
    CONSTRAINT chk_class_sessions_time_range CHECK (start_time < end_time),
    CONSTRAINT fk_class_sessions_room
        FOREIGN KEY (room_id) REFERENCES rooms (room_id),
    CONSTRAINT fk_class_sessions_booking_room_time
        FOREIGN KEY (booking_id, room_id, start_time, end_time)
        REFERENCES bookings (booking_id, room_id, start_time, end_time)
);

CREATE INDEX idx_class_sessions_room_time
    ON class_sessions (room_id, start_time, end_time);
CREATE INDEX idx_class_sessions_start_time ON class_sessions (start_time);

-- Extend existing seats without dropping seats or legacy booking_seats.
-- Fail atomically if existing seat numbers are duplicate or non-positive.
ALTER TABLE seats
    ADD CONSTRAINT uq_seats_room_number UNIQUE (room_id, seat_number),
    ADD CONSTRAINT uq_seats_id_room UNIQUE (seat_id, room_id),
    ADD CONSTRAINT chk_seats_number_positive CHECK (seat_number > 0);

CREATE TABLE seat_reservations (
    seat_reservation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_session_id BIGINT NOT NULL,
    seat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    room_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_seat_reservations_status
        CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    CONSTRAINT fk_seat_reservations_user
        FOREIGN KEY (user_id) REFERENCES users (user_id),
    -- The same room_id must match BOTH the session and the seat.
    CONSTRAINT fk_seat_reservations_session_room
        FOREIGN KEY (class_session_id, room_id)
        REFERENCES class_sessions (class_session_id, room_id),
    CONSTRAINT fk_seat_reservations_seat_room
        FOREIGN KEY (seat_id, room_id) REFERENCES seats (seat_id, room_id)
);

-- Keep cancelled rows for history and allow rebooking after cancellation.
-- These unique indexes also arbitrate concurrent inserts/updates.
CREATE UNIQUE INDEX uq_seat_reservations_active_seat
    ON seat_reservations (class_session_id, seat_id)
    WHERE status = 'CONFIRMED';
CREATE UNIQUE INDEX uq_seat_reservations_active_user
    ON seat_reservations (class_session_id, user_id)
    WHERE status = 'CONFIRMED';

CREATE INDEX idx_seat_reservations_session_status
    ON seat_reservations (class_session_id, status);
CREATE INDEX idx_seat_reservations_user_status
    ON seat_reservations (user_id, status, created_at DESC);
CREATE INDEX idx_seat_reservations_seat_room
    ON seat_reservations (seat_id, room_id);

COMMENT ON TABLE class_sessions IS 'One session per room booking; room and time must match that booking exactly.';
COMMENT ON TABLE seat_reservations IS 'Seat selection per session; confirmed rows are unique per seat and per user.';
COMMENT ON COLUMN seat_reservations.room_id IS 'Derived by backend from the class session, not trusted from the client; composite FKs enforce room consistency.';
COMMENT ON TABLE booking_seats IS 'Legacy booking-to-seat association. New per-session selections use seat_reservations; legacy rows are not auto-migrated.';

COMMIT;
