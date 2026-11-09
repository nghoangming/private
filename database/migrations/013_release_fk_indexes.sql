BEGIN;
SET LOCAL lock_timeout = '10s';
-- Full indexes support FK parent update/delete checks, including cancelled/failed history.
-- Partial success-only index in 012 does not cover all checkins.
CREATE INDEX idx_checkins_booking_user ON checkins(booking_id,user_id);
CREATE INDEX idx_checkins_user ON checkins(user_id);
CREATE INDEX idx_booking_seats_seat ON booking_seats(seat_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX idx_absence_requests_session ON absence_requests(class_session_id);
CREATE INDEX idx_absence_requests_user_created ON absence_requests(user_id,created_at DESC);
COMMIT;
