-- Apply once after 010 to release rooms for sessions reported absent before this fix.
BEGIN;
SET LOCAL lock_timeout = '10s';

UPDATE seat_reservations sr
SET status = 'CANCELLED'
FROM class_sessions cs
WHERE sr.class_session_id = cs.class_session_id
  AND cs.calendar_status = 'ABSENT'
  AND sr.status = 'CONFIRMED';

UPDATE bookings b
SET status = 'CANCELLED'
FROM class_sessions cs
WHERE cs.booking_id = b.booking_id
  AND cs.calendar_status = 'ABSENT'
  AND b.status = 'CONFIRMED';

COMMIT;
