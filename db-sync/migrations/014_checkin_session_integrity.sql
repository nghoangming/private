BEGIN;
SET LOCAL lock_timeout = '10s';
-- Bind every issued challenge to its session's exact booking, including direct SQL writes.
ALTER TABLE checkin_challenges ADD COLUMN booking_id BIGINT;
UPDATE checkin_challenges ch SET booking_id=cs.booking_id
FROM class_sessions cs WHERE cs.class_session_id=ch.class_session_id;
ALTER TABLE checkin_challenges
 ALTER COLUMN booking_id SET NOT NULL,
 ADD CONSTRAINT fk_challenge_session_booking FOREIGN KEY(class_session_id,booking_id)
 REFERENCES class_sessions(class_session_id,booking_id),
 ADD CONSTRAINT uq_challenge_id_booking UNIQUE(challenge_id,booking_id);

CREATE FUNCTION derive_challenge_booking() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT booking_id INTO STRICT NEW.booking_id FROM class_sessions
 WHERE class_session_id=NEW.class_session_id;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_challenge_booking BEFORE INSERT OR UPDATE OF class_session_id,booking_id
 ON checkin_challenges FOR EACH ROW EXECUTE FUNCTION derive_challenge_booking();

-- Legacy/failed check-ins may have no challenge. Any supplied challenge must match booking.
ALTER TABLE checkins ADD CONSTRAINT fk_checkin_challenge_booking
 FOREIGN KEY(challenge_id,booking_id) REFERENCES checkin_challenges(challenge_id,booking_id);
COMMIT;
