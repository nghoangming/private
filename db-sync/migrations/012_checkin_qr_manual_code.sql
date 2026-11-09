BEGIN;
SET LOCAL lock_timeout = '10s';

-- Prerequisites: 001, 002, 006, 008. Never silently reinterpret old values.
LOCK TABLE checkins IN ACCESS EXCLUSIVE MODE;
UPDATE checkins SET method = upper(btrim(method)), status = upper(btrim(status));
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM checkins WHERE method NOT IN ('QR', 'MANUAL_CODE')
        OR status NOT IN ('SUCCESS', 'FAILED')) THEN
        RAISE EXCEPTION 'Migration 012 stopped: review legacy checkins.method/status using preflight_checkins.sql; no changes committed.';
    END IF;
    IF EXISTS (SELECT 1 FROM checkins WHERE status = 'SUCCESS'
        GROUP BY booking_id, user_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'Migration 012 stopped: duplicate successful check-ins; reconcile history before retrying. No rows deleted.';
    END IF;
END $$;
ALTER TABLE checkins
    ADD CONSTRAINT chk_checkins_method CHECK (method IN ('QR', 'MANUAL_CODE')),
    ADD CONSTRAINT chk_checkins_status CHECK (status IN ('SUCCESS', 'FAILED'));

ALTER TABLE checkins ADD COLUMN revoked_at TIMESTAMPTZ, ADD COLUMN revoked_by BIGINT REFERENCES users(user_id);

-- One booking per class session (006): covers QR/manual retries and races.
-- Failed attempts do not consume the student's successful check-in.
CREATE UNIQUE INDEX uq_checkins_success_booking_user
    ON checkins (booking_id, user_id) WHERE status = 'SUCCESS' AND revoked_at IS NULL;

CREATE TABLE checkin_challenges (
    challenge_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_session_id BIGINT NOT NULL REFERENCES class_sessions(class_session_id),
    qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    manual_code VARCHAR(5) NOT NULL,
    issued_by BIGINT NOT NULL REFERENCES users(user_id),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT chk_challenge_code CHECK (
        manual_code ~ '^[A-Z0-9]{5}$' AND manual_code ~ '[A-Z]' AND manual_code ~ '[0-9]'
    ),
    CONSTRAINT chk_challenge_expiry CHECK (expires_at > issued_at),
    CONSTRAINT uq_challenge_session_code UNIQUE (class_session_id, manual_code),
    CONSTRAINT uq_challenge_id_session UNIQUE (challenge_id, class_session_id)
);
CREATE UNIQUE INDEX uq_challenge_active_session
    ON checkin_challenges(class_session_id) WHERE revoked_at IS NULL;

ALTER TABLE checkins ADD COLUMN challenge_id BIGINT REFERENCES checkin_challenges(challenge_id);

CREATE FUNCTION issue_checkin_challenge(p_session BIGINT,p_actor BIGINT)
RETURNS checkin_challenges LANGUAGE plpgsql AS $$
DECLARE v_session class_sessions; v_booking bookings; v_code TEXT; v_result checkin_challenges;
        v_now TIMESTAMPTZ;
BEGIN
  SELECT * INTO STRICT v_session FROM class_sessions WHERE class_session_id=p_session FOR UPDATE;
  SELECT * INTO STRICT v_booking FROM bookings WHERE booking_id=v_session.booking_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
    WHERE ur.user_id=p_actor AND (r.role_name='ADMIN' OR
      (r.role_name='TEACHER' AND v_booking.user_id=p_actor))) THEN
    RAISE EXCEPTION 'Session teacher or admin required' USING ERRCODE='42501';
  END IF;
  v_now:=clock_timestamp();
  IF v_booking.status<>'CONFIRMED' OR v_now<v_session.start_time+interval '5 minutes'
      OR v_now>=LEAST(v_session.start_time+interval '20 minutes',v_session.end_time) THEN
    RAISE EXCEPTION 'Check-in opens from minute 5 until minute 20 of a confirmed class' USING ERRCODE='23514';
  END IF;
  LOOP
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
    EXIT WHEN v_code ~ '[A-Z]' AND v_code ~ '[0-9]' AND NOT EXISTS (
      SELECT 1 FROM checkin_challenges WHERE class_session_id=p_session AND manual_code=v_code);
  END LOOP;
  UPDATE checkin_challenges SET revoked_at=v_now
    WHERE class_session_id=p_session AND revoked_at IS NULL;
  INSERT INTO checkin_challenges(class_session_id,manual_code,issued_by,expires_at)
    VALUES(p_session,v_code,p_actor,LEAST(v_now+interval '2 minutes',
      v_session.start_time+interval '20 minutes',v_session.end_time))
    RETURNING * INTO v_result;
  RETURN v_result;
END $$;

CREATE FUNCTION submit_class_checkin(p_session BIGINT,p_student BIGINT,p_method TEXT,p_code TEXT)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_session class_sessions; v_booking bookings; v_reservation seat_reservations;
        v_challenge checkin_challenges; v_checkin BIGINT; v_time TIMESTAMPTZ;
BEGIN
  SELECT * INTO STRICT v_session FROM class_sessions WHERE class_session_id=p_session FOR UPDATE;
  SELECT * INTO STRICT v_booking FROM bookings WHERE booking_id=v_session.booking_id FOR UPDATE;
  v_time:=clock_timestamp();
  IF v_booking.status<>'CONFIRMED' OR v_time<v_session.start_time+interval '5 minutes'
      OR v_time>=LEAST(v_session.start_time+interval '20 minutes',v_session.end_time) THEN
    RAISE EXCEPTION 'Check-in is closed' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
      WHERE ur.user_id=p_student AND r.role_name='STUDENT') THEN
    RAISE EXCEPTION 'Student account required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_reservation FROM seat_reservations
      WHERE class_session_id=p_session AND user_id=p_student AND status='CONFIRMED' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Confirmed seat required' USING ERRCODE='23514'; END IF;
  IF p_method IS NULL OR p_method NOT IN ('QR','MANUAL_CODE') THEN
    RAISE EXCEPTION 'Invalid check-in method' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_challenge FROM checkin_challenges
      WHERE class_session_id=p_session AND revoked_at IS NULL AND expires_at>v_time
        AND ((p_method='QR' AND qr_token::text=p_code)
          OR (p_method='MANUAL_CODE' AND manual_code=upper(btrim(p_code))));
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired check-in code' USING ERRCODE='23514'; END IF;
  INSERT INTO checkins(booking_id,user_id,checked_in_at,method,status,challenge_id)
      VALUES(v_booking.booking_id,p_student,v_time,p_method,'SUCCESS',v_challenge.challenge_id)
      RETURNING checkin_id INTO v_checkin;
  INSERT INTO attendance(booking_id,user_id,class_session_id,seat_reservation_id,
      checkin_id,attendance_status,check_in_at)
      VALUES(v_booking.booking_id,p_student,p_session,v_reservation.seat_reservation_id,
        v_checkin,'PRESENT',v_time)
      ON CONFLICT (class_session_id,user_id) DO UPDATE SET
        seat_reservation_id=EXCLUDED.seat_reservation_id,
        checkin_id=EXCLUDED.checkin_id,attendance_status='PRESENT',check_in_at=EXCLUDED.check_in_at,
        cancelled_at=NULL,cancelled_by=NULL;
  RETURN v_checkin;
END $$;

CREATE FUNCTION revoke_class_checkin(p_session BIGINT,p_student BIGINT,p_teacher BIGINT)
RETURNS attendance LANGUAGE plpgsql AS $$
DECLARE v_booking bookings; v_attendance attendance;
BEGIN
  SELECT b.* INTO STRICT v_booking FROM class_sessions cs JOIN bookings b USING(booking_id)
      WHERE cs.class_session_id=p_session FOR UPDATE OF b;
  IF v_booking.user_id<>p_teacher OR NOT EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
      WHERE ur.user_id=p_teacher AND r.role_name='TEACHER') THEN
    RAISE EXCEPTION 'Only the session teacher may revoke check-in' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT v_attendance FROM attendance
      WHERE class_session_id=p_session AND user_id=p_student FOR UPDATE;
  IF v_attendance.attendance_status<>'PRESENT' OR v_attendance.checkin_id IS NULL THEN
    RAISE EXCEPTION 'Student is not checked in' USING ERRCODE='23514';
  END IF;
  UPDATE checkins SET revoked_at=clock_timestamp(),revoked_by=p_teacher
      WHERE checkin_id=v_attendance.checkin_id AND revoked_at IS NULL;
  UPDATE attendance SET attendance_status='PENDING',checkin_id=NULL,check_in_at=NULL,
      cancelled_at=clock_timestamp(),cancelled_by=p_teacher
      WHERE attendance_id=v_attendance.attendance_id RETURNING * INTO v_attendance;
  RETURN v_attendance;
END $$;
REVOKE ALL ON FUNCTION issue_checkin_challenge(BIGINT,BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_class_checkin(BIGINT,BIGINT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION revoke_class_checkin(BIGINT,BIGINT,BIGINT) FROM PUBLIC;
REVOKE ALL ON checkin_challenges FROM PUBLIC;
COMMIT;
