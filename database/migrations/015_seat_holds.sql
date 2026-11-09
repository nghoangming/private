BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE seat_reservations IN ACCESS EXCLUSIVE MODE;
ALTER TABLE seat_reservations
 ADD COLUMN hold_expires_at TIMESTAMPTZ,
 ALTER COLUMN status SET DEFAULT 'PENDING',
 DROP CONSTRAINT chk_seat_reservations_status;
ALTER TABLE seat_reservations
 ADD CONSTRAINT chk_seat_reservations_status CHECK(status IN ('PENDING','CONFIRMED','CANCELLED')),
 ADD CONSTRAINT chk_seat_hold_expiry CHECK(status <> 'PENDING' OR hold_expires_at IS NOT NULL);
DROP INDEX uq_seat_reservations_active_seat;
DROP INDEX uq_seat_reservations_active_user;
CREATE UNIQUE INDEX uq_seat_reservations_active_seat
 ON seat_reservations(class_session_id,seat_id) WHERE status IN ('PENDING','CONFIRMED');
CREATE UNIQUE INDEX uq_seat_reservations_active_user
 ON seat_reservations(class_session_id,user_id) WHERE status IN ('PENDING','CONFIRMED');
CREATE INDEX idx_seat_holds_expiry ON seat_reservations(class_session_id,hold_expires_at)
 WHERE status='PENDING';

-- Applies to direct writes too. Existing history is left unchanged.
CREATE FUNCTION guard_seat_registration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_status text;
BEGIN
 IF NEW.status IN ('PENDING','CONFIRMED') THEN
   SELECT b.status INTO v_status FROM class_sessions cs JOIN bookings b USING(booking_id)
    WHERE cs.class_session_id=NEW.class_session_id FOR UPDATE OF b;
   IF FOUND AND v_status <> 'CONFIRMED' THEN
     RAISE EXCEPTION 'Class booking must be approved before seat registration' USING ERRCODE='23514';
   END IF;
   IF NEW.status='PENDING' AND NEW.hold_expires_at IS NULL THEN
     NEW.hold_expires_at := clock_timestamp()+interval '2 minutes';
   END IF;
   IF TG_OP='UPDATE' THEN
     IF OLD.status='PENDING' AND NEW.status='CONFIRMED'
        AND OLD.hold_expires_at <= clock_timestamp() THEN
       RAISE EXCEPTION 'Seat hold expired' USING ERRCODE='23514';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_seat_registration BEFORE INSERT OR UPDATE OF status,class_session_id,seat_id,user_id,room_id
 ON seat_reservations FOR EACH ROW EXECUTE FUNCTION guard_seat_registration();

-- Identity parameters are supplied by the trusted backend, never taken from request JSON.
CREATE FUNCTION hold_class_seat(p_session bigint,p_seat bigint,p_student bigint)
RETURNS seat_reservations LANGUAGE plpgsql AS $$
DECLARE v_session class_sessions; v_status text; v_seat seats; v_result seat_reservations;
BEGIN
 SELECT * INTO STRICT v_session FROM class_sessions WHERE class_session_id=p_session FOR UPDATE;
 SELECT status INTO STRICT v_status FROM bookings WHERE booking_id=v_session.booking_id FOR UPDATE;
 IF v_status <> 'CONFIRMED' THEN RAISE EXCEPTION 'Class booking must be approved before seat registration' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
   WHERE ur.user_id=p_student AND r.role_name='STUDENT') THEN
   RAISE EXCEPTION 'Student account required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO STRICT v_seat FROM seats WHERE seat_id=p_seat FOR UPDATE;
 IF v_seat.room_id<>v_session.room_id OR v_seat.status<>'AVAILABLE' THEN
   RAISE EXCEPTION 'Seat must be available in this class room' USING ERRCODE='23514';
 END IF;
 -- Expired rows no longer own a seat; keep them as cancelled history.
 UPDATE seat_reservations SET status='CANCELLED' WHERE class_session_id=p_session
   AND status='PENDING' AND hold_expires_at<=clock_timestamp();
 -- Retrying one's own hold returns its original deadline, never extends it.
 SELECT * INTO v_result FROM seat_reservations WHERE class_session_id=p_session
   AND seat_id=p_seat AND user_id=p_student AND status='PENDING';
 IF FOUND THEN RETURN v_result; END IF;
 INSERT INTO seat_reservations(class_session_id,seat_id,user_id,room_id,status,hold_expires_at)
 VALUES(p_session,p_seat,p_student,v_session.room_id,'PENDING',clock_timestamp()+interval '2 minutes')
 RETURNING * INTO v_result;
 RETURN v_result;
END $$;

CREATE FUNCTION confirm_class_seat(p_reservation bigint,p_student bigint)
RETURNS seat_reservations LANGUAGE plpgsql AS $$
DECLARE v_session bigint; v_result seat_reservations;
BEGIN
 SELECT class_session_id INTO STRICT v_session FROM seat_reservations WHERE seat_reservation_id=p_reservation;
 PERFORM 1 FROM class_sessions WHERE class_session_id=v_session FOR UPDATE;
 PERFORM 1 FROM bookings b JOIN class_sessions cs USING(booking_id)
 WHERE cs.class_session_id=v_session FOR UPDATE OF b;
 SELECT * INTO STRICT v_result FROM seat_reservations WHERE seat_reservation_id=p_reservation FOR UPDATE;
 IF v_result.user_id<>p_student THEN RAISE EXCEPTION 'Seat hold belongs to another user' USING ERRCODE='42501'; END IF;
 IF v_result.status='CONFIRMED' THEN RETURN v_result; END IF;
 IF v_result.status<>'PENDING' OR v_result.hold_expires_at<=clock_timestamp() THEN
   RAISE EXCEPTION 'Seat hold expired or cancelled' USING ERRCODE='23514';
 END IF;
 UPDATE seat_reservations SET status='CONFIRMED' WHERE seat_reservation_id=p_reservation RETURNING * INTO v_result;
 RETURN v_result;
END $$;

CREATE FUNCTION cancel_class_seat(p_reservation bigint,p_student bigint)
RETURNS seat_reservations LANGUAGE plpgsql AS $$
DECLARE v_session bigint; v_result seat_reservations;
BEGIN
 SELECT class_session_id INTO STRICT v_session FROM seat_reservations WHERE seat_reservation_id=p_reservation;
 PERFORM 1 FROM class_sessions WHERE class_session_id=v_session FOR UPDATE;
 SELECT * INTO STRICT v_result FROM seat_reservations WHERE seat_reservation_id=p_reservation FOR UPDATE;
 IF v_result.user_id<>p_student THEN RAISE EXCEPTION 'Seat reservation belongs to another user' USING ERRCODE='42501'; END IF;
 UPDATE seat_reservations SET status='CANCELLED' WHERE seat_reservation_id=p_reservation RETURNING * INTO v_result;
 RETURN v_result;
END $$;

CREATE VIEW class_seat_availability AS
SELECT cs.class_session_id,s.seat_id,s.room_id,s.seat_number,s.status AS physical_status,
 CASE WHEN sr.status='CONFIRMED' THEN 'RESERVED'
      WHEN sr.status='PENDING' THEN 'PENDING' ELSE 'AVAILABLE' END AS reservation_status,
 sr.hold_expires_at
FROM class_sessions cs JOIN seats s ON s.room_id=cs.room_id
LEFT JOIN seat_reservations sr ON sr.class_session_id=cs.class_session_id AND sr.seat_id=s.seat_id
 AND (sr.status='CONFIRMED' OR (sr.status='PENDING' AND sr.hold_expires_at>clock_timestamp()));
REVOKE ALL ON FUNCTION hold_class_seat(bigint,bigint,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION confirm_class_seat(bigint,bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_class_seat(bigint,bigint) FROM PUBLIC;
COMMENT ON VIEW class_seat_availability IS 'Reservation state per session; physical_status must also be checked. Expired holds appear available and are reclaimed by hold_class_seat.';
COMMIT;
