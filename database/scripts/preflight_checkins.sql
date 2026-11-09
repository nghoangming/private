-- Read-only. Run on the actual database before migration 012.
SELECT current_database(), current_user;
SELECT method, status, count(*) FROM checkins GROUP BY method, status ORDER BY method, status;
SELECT booking_id, user_id, count(*) AS successful_checkins
FROM checkins WHERE upper(btrim(status)) = 'SUCCESS'
GROUP BY booking_id, user_id HAVING count(*) > 1;
SELECT a.attendance_id, a.attendance_status, a.check_in_at, c.checked_in_at, c.status
FROM attendance a JOIN checkins c USING(checkin_id)
WHERE a.check_in_at IS DISTINCT FROM c.checked_in_at
   OR (a.attendance_status IN ('PRESENT', 'LATE') AND upper(btrim(c.status)) <> 'SUCCESS');
