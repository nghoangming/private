-- room_code already has an index through its UNIQUE constraint in migration 001.
CREATE INDEX idx_rooms_status_location ON rooms (status, location);

-- Matches the room/time overlap query and excludes cancelled/rejected bookings.
CREATE INDEX idx_bookings_room_active_time
    ON bookings (room_id, start_time, end_time)
    WHERE upper(status) NOT IN ('CANCELLED', 'CANCELED', 'REJECTED');

CREATE INDEX idx_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_user_code_lower ON users (lower(user_code));
CREATE INDEX idx_user_roles_role ON user_roles (role_id);

ALTER TABLE bookings
    ADD CONSTRAINT chk_bookings_time_range CHECK (start_time < end_time);
