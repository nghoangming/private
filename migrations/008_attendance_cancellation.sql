-- Run once after 007. Keep cancelled check-ins for audit and allow a new check-in.
BEGIN;
ALTER TABLE attendance
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by BIGINT REFERENCES users(user_id);
DROP INDEX uq_attendance_booking_user;
CREATE UNIQUE INDEX uq_attendance_booking_user_active
    ON attendance(booking_id, user_id)
    WHERE attendance_status = 'PRESENT';
COMMIT;
