-- Read-only checks before manually applying migrations 005 and 006 in CNPM.
-- The SELECT itself does not change status values or delete conflicting data.
SELECT current_database(), current_user;

-- Must be empty. APPROVED/CANCELED and case/space variants will be normalized.
SELECT booking_id, status FROM bookings
WHERE upper(btrim(status)) NOT IN ('PENDING','CONFIRMED','APPROVED','CANCELLED','CANCELED','REJECTED');

-- Must be empty: invalid ranges.
SELECT booking_id, start_time, end_time FROM bookings WHERE start_time >= end_time;

-- Must be empty: active overlapping bookings.
SELECT first_booking.booking_id AS first_booking_id,
       second_booking.booking_id AS second_booking_id,
       first_booking.room_id
FROM bookings first_booking
JOIN bookings second_booking
  ON first_booking.room_id = second_booking.room_id
 AND first_booking.booking_id < second_booking.booking_id
 AND first_booking.start_time < second_booking.end_time
 AND first_booking.end_time > second_booking.start_time
WHERE upper(btrim(first_booking.status)) NOT IN ('CANCELLED','CANCELED','REJECTED')
  AND upper(btrim(second_booking.status)) NOT IN ('CANCELLED','CANCELED','REJECTED');

-- Must be empty: duplicate or invalid physical seats.
SELECT room_id, seat_number, count(*) FROM seats
GROUP BY room_id, seat_number HAVING count(*) > 1;
SELECT seat_id, room_id, seat_number FROM seats WHERE seat_number <= 0;

-- Verify the existing FK/time requirements from migrations 001 and 003.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- Run each new migration ONCE. Check whether it has already been applied.
SELECT to_regclass('public.class_sessions') AS class_sessions,
       to_regclass('public.seat_reservations') AS seat_reservations;
SELECT conname FROM pg_constraint
WHERE conrelid = 'bookings'::regclass AND conname = 'ex_bookings_room_active_time';
