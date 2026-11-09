BEGIN;
SET LOCAL lock_timeout = '10s';
-- Transaction-local context must be set by a trusted authenticated backend.
-- Missing context fails closed; these helpers do not authenticate a user.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS BIGINT
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id', true), '')::bigint
$$;
CREATE OR REPLACE FUNCTION app_current_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.role', true), '')
$$;
--1.Bổ sung bảng absence_requests để quản lý các yêu cầu vắng mặt của sinh viên và giáo viên
CREATE TABLE absence_requests (
    absence_request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    class_session_id BIGINT NOT NULL REFERENCES class_sessions(class_session_id),
    request_type VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by BIGINT REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_absence_request_type CHECK (request_type IN ('STUDENT', 'TEACHER')),
    CONSTRAINT chk_absence_request_status
        CHECK (status IN (
            'PENDING',
            'APPROVED',
            'REJECTED',
            'CANCELLED'
        ))
);

-- One unresolved or approved request per student and class session.
CREATE UNIQUE INDEX uq_student_absence_active
ON absence_requests(class_session_id, user_id)
WHERE request_type='STUDENT' AND status IN ('PENDING','APPROVED');

-- Also protects direct writes made by a database owner that bypasses RLS.
CREATE FUNCTION guard_absence_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_session class_sessions; v_booking bookings;
BEGIN
  SELECT * INTO STRICT v_session FROM class_sessions
    WHERE class_session_id=NEW.class_session_id FOR UPDATE;
  SELECT * INTO STRICT v_booking FROM bookings WHERE booking_id=v_session.booking_id FOR UPDATE;
  IF NEW.status<>'PENDING' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL THEN
    RAISE EXCEPTION 'New absence request must be pending' USING ERRCODE='23514';
  END IF;
  IF v_booking.status<>'CONFIRMED' THEN
    RAISE EXCEPTION 'Confirmed class booking required' USING ERRCODE='23514';
  END IF;
  IF NEW.request_type='TEACHER' THEN
    IF NEW.user_id<>v_booking.user_id OR NOT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
        WHERE ur.user_id=NEW.user_id AND r.role_name='TEACHER') THEN
      RAISE EXCEPTION 'Session teacher required' USING ERRCODE='42501';
    END IF;
    IF clock_timestamp()>v_session.start_time-interval '1 hour' THEN
      RAISE EXCEPTION 'Teacher absence deadline passed' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.request_type='STUDENT' THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
        WHERE ur.user_id=NEW.user_id AND r.role_name='STUDENT') OR NOT EXISTS (
        SELECT 1 FROM seat_reservations sr WHERE sr.class_session_id=NEW.class_session_id
          AND sr.user_id=NEW.user_id AND sr.status='CONFIRMED') THEN
      RAISE EXCEPTION 'Confirmed seat for this student and class required' USING ERRCODE='23514';
    END IF;
    IF clock_timestamp()>v_session.start_time-interval '15 minutes' THEN
      RAISE EXCEPTION 'Student absence deadline passed' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_absence_submission BEFORE INSERT ON absence_requests
FOR EACH ROW EXECUTE FUNCTION guard_absence_submission();

--2. Bổ sung phân quyền và permissions để quản lý incidents, notifications và audit_logs
INSERT INTO permissions (permission_name)
VALUES
    ('VIEW_OWN_INCIDENTS'),
    ('VIEW_NOTIFICATIONS'),
    ('MANAGE_NOTIFICATIONS'),
    ('VIEW_AUDIT_LOGS'),
    ('MANAGE_RBAC'),
    ('CREATE_OWN_ABSENCE_REQUEST'),
    ('VIEW_OWN_ABSENCE_REQUESTS'),    
    ('REVIEW_STUDENT_ABSENCE'),
    ('REVIEW_TEACHER_ABSENCE')
ON CONFLICT (permission_name) DO NOTHING;

--Gán cho ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'ADMIN'
AND p.permission_name IN (
    'VIEW_TEACHING_SCHEDULE',
    'VIEW_OWN_INCIDENTS',
    'VIEW_NOTIFICATIONS',
    'MANAGE_NOTIFICATIONS',
    'VIEW_AUDIT_LOGS',
    'MANAGE_RBAC',
    'CREATE_OWN_ABSENCE_REQUEST',
    'VIEW_OWN_ABSENCE_REQUESTS',
    'REVIEW_TEACHER_ABSENCE'
)
ON CONFLICT DO NOTHING;

--Gán cho TEACHER
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'TEACHER'
AND p.permission_name IN (
    'VIEW_OWN_INCIDENTS',
    'VIEW_NOTIFICATIONS',
    'CREATE_OWN_ABSENCE_REQUEST',
    'VIEW_OWN_ABSENCE_REQUESTS',
    'REVIEW_STUDENT_ABSENCE'
)
ON CONFLICT DO NOTHING;

--Gán cho STUDENT
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'STUDENT'
AND p.permission_name IN (
    'VIEW_NOTIFICATIONS',
    'CREATE_OWN_ABSENCE_REQUEST',
    'VIEW_OWN_ABSENCE_REQUESTS'
)
ON CONFLICT DO NOTHING;

--3. Data access mapping for RBAC
-- Phân quyền bảng absence_requests
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS absence_requests_select_policy
ON absence_requests;

CREATE POLICY absence_requests_select_policy
ON absence_requests
FOR SELECT
USING (
    user_id = app_current_user_id()

    OR (
        request_type = 'TEACHER'
        AND app_current_role() = 'ADMIN'
    )

    OR (
        request_type = 'STUDENT'
        AND app_current_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id =
                  absence_requests.class_session_id
              AND b.user_id = app_current_user_id()
        )
    )
);


DROP POLICY IF EXISTS absence_requests_insert_policy
ON absence_requests;

CREATE POLICY absence_requests_insert_policy
ON absence_requests
FOR INSERT
WITH CHECK (
    user_id = app_current_user_id()

    AND (
        (
            request_type = 'TEACHER'
            AND app_current_role() = 'TEACHER'
            AND EXISTS (
                SELECT 1
                FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
                WHERE cs.class_session_id =
                      absence_requests.class_session_id
                  AND b.user_id = app_current_user_id()
                  AND b.status = 'CONFIRMED'
                  AND clock_timestamp() <= cs.start_time - interval '1 hour'
            )
        )

        OR (
            request_type = 'STUDENT'
            AND app_current_role() = 'STUDENT'
            AND EXISTS (
                SELECT 1
                FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
                JOIN seat_reservations sr ON sr.class_session_id = cs.class_session_id
                WHERE cs.class_session_id =
                      absence_requests.class_session_id
                  AND b.status = 'CONFIRMED'
                  AND sr.user_id = app_current_user_id()
                  AND sr.status = 'CONFIRMED'
                  AND clock_timestamp() <= cs.start_time - interval '15 minutes'
            )
        )
    )
);


DROP POLICY IF EXISTS absence_requests_review_policy
ON absence_requests;

CREATE POLICY absence_requests_review_policy
ON absence_requests
FOR UPDATE
USING (
    (
        request_type = 'TEACHER'
        AND app_current_role() = 'ADMIN'
    )

    OR (
        request_type = 'STUDENT'
        AND app_current_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id =
                  absence_requests.class_session_id
              AND b.user_id = app_current_user_id()
        )
    )
)
WITH CHECK (
    (
        request_type = 'TEACHER'
        AND app_current_role() = 'ADMIN'
    )

    OR (
        request_type = 'STUDENT'
        AND app_current_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id =
                  absence_requests.class_session_id
              AND b.user_id = app_current_user_id()
        )
    )
);

--Phần quyền bảng incidents
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incidents_select_policy
ON incidents;

CREATE POLICY incidents_select_policy
ON incidents
FOR SELECT
USING (
    app_current_role() = 'ADMIN'
    OR reported_by = app_current_user_id()
);


DROP POLICY IF EXISTS incidents_insert_policy
ON incidents;

CREATE POLICY incidents_insert_policy
ON incidents
FOR INSERT
WITH CHECK (
    reported_by = app_current_user_id()
    AND app_current_role() = 'TEACHER'
);


DROP POLICY IF EXISTS incidents_update_policy
ON incidents;

CREATE POLICY incidents_update_policy
ON incidents
FOR UPDATE
USING (
    app_current_role() = 'ADMIN'
)
WITH CHECK (
    app_current_role() = 'ADMIN'
);

--Phân quyền bảng notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_policy
ON notifications;

CREATE POLICY notifications_select_policy
ON notifications
FOR SELECT
USING (
    user_id = app_current_user_id()
);

-- Admin review creates notifications for the affected teacher and seated students.
CREATE POLICY notifications_insert_policy ON notifications FOR INSERT
WITH CHECK (app_current_role() = 'ADMIN');


DROP POLICY IF EXISTS notifications_update_policy
ON notifications;

CREATE POLICY notifications_update_policy
ON notifications
FOR UPDATE
USING (
    user_id = app_current_user_id()
)
WITH CHECK (
    user_id = app_current_user_id()
);

--Phân quyền bảng audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy
ON audit_logs;

CREATE POLICY audit_logs_select_policy
ON audit_logs
FOR SELECT
USING (
    app_current_role() = 'ADMIN'
);

--Kiểm tra chính sách RLS 
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN (
    'absence_requests',
    'incidents',
    'notifications',
    'audit_logs'
)
ORDER BY tablename, policyname;

CREATE UNIQUE INDEX uq_teacher_absence_pending ON absence_requests(class_session_id)
  WHERE request_type='TEACHER' AND status='PENDING';
CREATE VIEW class_session_calendar AS
SELECT cs.class_session_id, cs.booking_id, cs.course_code, cs.title, cs.room_id,
       cs.start_time, cs.end_time, cs.session_kind,
       CASE WHEN EXISTS (SELECT 1 FROM absence_requests ar WHERE ar.class_session_id=cs.class_session_id
                 AND ar.request_type='TEACHER' AND ar.status='APPROVED') THEN 'ABSENT'
            WHEN cs.session_kind='MAKEUP' THEN 'MAKEUP' ELSE 'SCHEDULED' END AS calendar_status
FROM class_sessions cs;

CREATE FUNCTION request_teacher_absence(p_session BIGINT,p_teacher BIGINT,p_reason TEXT)
RETURNS absence_requests LANGUAGE plpgsql AS $$
DECLARE v_booking bookings; v_result absence_requests;
BEGIN
  PERFORM 1 FROM class_sessions WHERE class_session_id=p_session FOR UPDATE;
  SELECT b.* INTO STRICT v_booking FROM class_sessions cs
    JOIN bookings b USING(booking_id) WHERE cs.class_session_id=p_session FOR UPDATE OF b;
  IF v_booking.user_id<>p_teacher OR NOT EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
    WHERE ur.user_id=p_teacher AND r.role_name='TEACHER') THEN
    RAISE EXCEPTION 'Only the session teacher may report absence' USING ERRCODE='42501';
  END IF;
  IF v_booking.status<>'CONFIRMED' OR clock_timestamp()>v_booking.start_time-interval '1 hour' THEN
    RAISE EXCEPTION 'Teacher absence must be requested at least one hour before class' USING ERRCODE='23514';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason))<5 THEN
    RAISE EXCEPTION 'Absence reason must have at least 5 characters' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM absence_requests WHERE class_session_id=p_session
      AND request_type='TEACHER' AND status IN ('PENDING','APPROVED')) THEN
    RAISE EXCEPTION 'Absence already requested or approved' USING ERRCODE='23505';
  END IF;
  INSERT INTO absence_requests(user_id,class_session_id,request_type,reason)
    VALUES(p_teacher,p_session,'TEACHER',btrim(p_reason)) RETURNING * INTO v_result;
  RETURN v_result;
END $$;

CREATE FUNCTION review_teacher_absence(p_request BIGINT,p_admin BIGINT,p_approve BOOLEAN,p_note TEXT DEFAULT NULL)
RETURNS absence_requests LANGUAGE plpgsql AS $$
DECLARE v_request absence_requests; v_booking bookings;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
      WHERE ur.user_id=p_admin AND r.role_name='ADMIN') THEN
    RAISE EXCEPTION 'Admin required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_request FROM absence_requests
    WHERE absence_request_id=p_request FOR UPDATE;
  IF v_request.request_type<>'TEACHER' OR v_request.status<>'PENDING' THEN
    RAISE EXCEPTION 'Teacher absence is not pending' USING ERRCODE='23514';
  END IF;
  SELECT b.* INTO STRICT v_booking FROM class_sessions cs JOIN bookings b USING(booking_id)
    WHERE cs.class_session_id=v_request.class_session_id FOR UPDATE OF b;
  IF p_approve THEN
    IF v_booking.status<>'CONFIRMED' THEN
      RAISE EXCEPTION 'Booking is no longer confirmed' USING ERRCODE='23514';
    END IF;
  END IF;
  UPDATE absence_requests SET status=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      reviewed_by=p_admin, reviewed_at=clock_timestamp(),review_note=p_note,updated_at=clock_timestamp()
    WHERE absence_request_id=p_request RETURNING * INTO v_request;
  IF p_approve THEN
    UPDATE seat_reservations SET status='CANCELLED'
      WHERE class_session_id=v_request.class_session_id AND status IN ('PENDING','CONFIRMED');
    UPDATE bookings SET status='CANCELLED' WHERE booking_id=v_booking.booking_id;
  END IF;
  RETURN v_request;
END $$;
REVOKE ALL ON FUNCTION request_teacher_absence(BIGINT,BIGINT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION review_teacher_absence(BIGINT,BIGINT,BOOLEAN,TEXT) FROM PUBLIC;

CREATE FUNCTION request_student_absence(p_session BIGINT,p_student BIGINT,p_reason TEXT)
RETURNS absence_requests LANGUAGE plpgsql AS $$
DECLARE v_result absence_requests;
BEGIN
  IF p_reason IS NULL OR length(btrim(p_reason))<5 THEN
    RAISE EXCEPTION 'Absence reason must have at least 5 characters' USING ERRCODE='23514';
  END IF;
  INSERT INTO absence_requests(user_id,class_session_id,request_type,reason)
    VALUES(p_student,p_session,'STUDENT',btrim(p_reason)) RETURNING * INTO v_result;
  RETURN v_result;
END $$;

CREATE FUNCTION review_student_absence(p_request BIGINT,p_teacher BIGINT,p_approve BOOLEAN,p_note TEXT DEFAULT NULL)
RETURNS absence_requests LANGUAGE plpgsql AS $$
DECLARE v_request absence_requests; v_booking bookings; v_seat seat_reservations;
BEGIN
  SELECT * INTO STRICT v_request FROM absence_requests
    WHERE absence_request_id=p_request FOR UPDATE;
  IF v_request.request_type<>'STUDENT' OR v_request.status<>'PENDING' THEN
    RAISE EXCEPTION 'Student absence is not pending' USING ERRCODE='23514';
  END IF;
  SELECT b.* INTO STRICT v_booking FROM class_sessions cs JOIN bookings b USING(booking_id)
    WHERE cs.class_session_id=v_request.class_session_id FOR UPDATE OF b;
  IF v_booking.user_id<>p_teacher OR NOT EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
      WHERE ur.user_id=p_teacher AND r.role_name='TEACHER') THEN
    RAISE EXCEPTION 'Only the session teacher may review student absence' USING ERRCODE='42501';
  END IF;
  IF p_approve THEN
    IF v_booking.status<>'CONFIRMED' THEN
      RAISE EXCEPTION 'Class booking is not confirmed' USING ERRCODE='23514';
    END IF;
    SELECT * INTO v_seat FROM seat_reservations
      WHERE class_session_id=v_request.class_session_id AND user_id=v_request.user_id
        AND status='CONFIRMED' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student no longer has a confirmed seat' USING ERRCODE='23514';
    END IF;
    IF EXISTS (SELECT 1 FROM attendance WHERE class_session_id=v_request.class_session_id
        AND user_id=v_request.user_id AND attendance_status IN ('PRESENT','LATE')) THEN
      RAISE EXCEPTION 'Student already checked in' USING ERRCODE='23514';
    END IF;
    INSERT INTO attendance(booking_id,user_id,class_session_id,seat_reservation_id,
        checkin_id,attendance_status,evaluated_by,evaluation_note)
      VALUES(v_booking.booking_id,v_request.user_id,v_request.class_session_id,
        v_seat.seat_reservation_id,NULL,'EXCUSED',p_teacher,p_note)
      ON CONFLICT (class_session_id,user_id) DO UPDATE SET
        attendance_status='EXCUSED',checkin_id=NULL,check_in_at=NULL,
        evaluated_by=p_teacher,evaluation_note=p_note;
  END IF;
  UPDATE absence_requests SET status=CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END,
      reviewed_by=p_teacher,reviewed_at=clock_timestamp(),review_note=p_note,
      updated_at=clock_timestamp()
    WHERE absence_request_id=p_request RETURNING * INTO v_request;
  RETURN v_request;
END $$;

REVOKE ALL ON FUNCTION request_student_absence(BIGINT,BIGINT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION review_student_absence(BIGINT,BIGINT,BOOLEAN,TEXT) FROM PUBLIC;

-- Review updates the request before releasing seats, so this trigger can identify recipients.
CREATE FUNCTION notify_teacher_absence_approved() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_booking_id BIGINT;
BEGIN
  SELECT booking_id INTO STRICT v_booking_id FROM class_sessions
    WHERE class_session_id=NEW.class_session_id;
  INSERT INTO notifications(user_id,title,message,notification_type,related_booking_id)
  SELECT recipients.user_id,
    CASE WHEN recipients.user_id=NEW.user_id THEN 'Yêu cầu báo vắng đã được duyệt'
      ELSE 'Buổi học đã được báo vắng' END,
    CASE WHEN recipients.user_id=NEW.user_id THEN 'Admin đã duyệt yêu cầu báo vắng của bạn.'
      ELSE 'Giảng viên đã được duyệt báo vắng cho buổi học này.' END,
    'ABSENCE',v_booking_id
  FROM (SELECT NEW.user_id AS user_id
        UNION
        SELECT sr.user_id FROM seat_reservations sr
        WHERE sr.class_session_id=NEW.class_session_id AND sr.status='CONFIRMED') recipients;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_teacher_absence_approved
AFTER UPDATE OF status ON absence_requests
FOR EACH ROW WHEN (NEW.request_type='TEACHER' AND OLD.status='PENDING' AND NEW.status='APPROVED')
EXECUTE FUNCTION notify_teacher_absence_approved();

CREATE FUNCTION guard_teacher_incident() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
      WHERE ur.user_id=NEW.reported_by AND r.role_name='TEACHER') THEN
    RAISE EXCEPTION 'Only teachers may report incidents' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_teacher_incident BEFORE INSERT ON incidents
FOR EACH ROW EXECUTE FUNCTION guard_teacher_incident();
COMMIT;
