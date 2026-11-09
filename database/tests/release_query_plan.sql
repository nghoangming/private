-- Synthetic scale test; fixtures roll back (sequences may advance).
BEGIN;
INSERT INTO bookings(user_id,room_id,start_time,end_time,status)
SELECT u.user_id,r.room_id, timestamptz '2035-01-01 00:00+07' + g * interval '2 hours',
 timestamptz '2035-01-01 01:00+07' + g * interval '2 hours','CONFIRMED'
FROM generate_series(1,10000) g
CROSS JOIN users u CROSS JOIN rooms r WHERE u.user_code='teacher' AND r.room_code='A101';
ANALYZE bookings;
EXPLAIN (ANALYZE,BUFFERS)
SELECT * FROM bookings WHERE room_id=(SELECT room_id FROM rooms WHERE room_code='A101')
 AND upper(status) NOT IN ('CANCELLED','CANCELED','REJECTED')
 AND start_time < timestamptz '2035-01-02 10:00+07'
 AND end_time > timestamptz '2035-01-02 09:00+07' ORDER BY start_time;
ROLLBACK;
