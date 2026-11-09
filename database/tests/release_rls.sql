-- Isolated test DB only. Role, grants and fixture roll back.
BEGIN;
CREATE ROLE campus_rc_reader NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO campus_rc_reader;
GRANT SELECT ON notifications, incidents, audit_logs, absence_requests, class_sessions, bookings TO campus_rc_reader;
INSERT INTO notifications(user_id,title,message)
 SELECT user_id,'RC isolation','fixture' FROM users WHERE user_code IN ('student','teacher');
SELECT set_config('app.user_id',(SELECT user_id::text FROM users WHERE user_code='student'),true);
SELECT set_config('app.role','STUDENT',true);
SET LOCAL ROLE campus_rc_reader;
DO $$ BEGIN
 IF (SELECT count(*) FROM notifications WHERE title='RC isolation') <> 1 THEN
   RAISE EXCEPTION 'RLS own notification isolation failed';
 END IF;
 IF EXISTS(SELECT 1 FROM notifications WHERE user_id<>app_current_user_id()) THEN
   RAISE EXCEPTION 'RLS leaked notification';
 END IF;
END $$;
SELECT set_config('app.user_id','',true),set_config('app.role','',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM notifications) THEN RAISE EXCEPTION 'Missing context must fail closed'; END IF;
 RAISE NOTICE 'PASS: non-owner/non-bypass RLS notification isolation and missing context';
END $$;
RESET ROLE;
ROLLBACK;
