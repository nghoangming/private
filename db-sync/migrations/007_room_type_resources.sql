BEGIN;

-- 1. ADD ROOM TYPE TO ROOMS
ALTER TABLE rooms
ADD COLUMN type VARCHAR(20);

ALTER TABLE rooms
ADD CONSTRAINT chk_rooms_type
CHECK (type IN ('THEORY', 'LAB', 'SELF_STUDY'));

-- 2. CLASSIFY EXISTING ROOMS 
UPDATE rooms
SET type = CASE
    WHEN room_code LIKE 'A%' THEN 'LAB'
    WHEN room_code LIKE 'B%' THEN 'THEORY'
    WHEN room_code LIKE 'C%' THEN 'SELF_STUDY'
END
WHERE type IS NULL;

-- 3. RESOURCE QUANTITY CONSTRAINTS
ALTER TABLE resources
ALTER COLUMN quantity SET NOT NULL;

ALTER TABLE resources
ADD CONSTRAINT chk_resources_quantity
CHECK (quantity >= 0);

ALTER TABLE resources
ALTER COLUMN resource_type SET NOT NULL;

-- 4. ROOM TYPE CONSTRAINT
ALTER TABLE rooms
ALTER COLUMN type SET NOT NULL;

-- 5. AUTO CLASSIFY NEW ROOMS
CREATE OR REPLACE FUNCTION set_type_by_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.type := CASE
        WHEN NEW.room_code LIKE 'A%' THEN 'LAB'
        WHEN NEW.room_code LIKE 'B%' THEN 'THEORY'
        WHEN NEW.room_code LIKE 'C%' THEN 'SELF_STUDY'
        ELSE NULL
    END;

    IF NEW.type IS NULL THEN
        RAISE EXCEPTION
            'Invalid room code: %. Room code must start with A, B or C.',
            NEW.room_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_type
BEFORE INSERT OR UPDATE OF room_code, type
ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_type_by_code();

CREATE FUNCTION guard_booking_room_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_type TEXT;
BEGIN
  SELECT type INTO STRICT v_type FROM rooms WHERE room_id=NEW.room_id;
  IF v_type='SELF_STUDY' THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
        WHERE ur.user_id=NEW.user_id AND r.role_name='STUDENT') THEN
      RAISE EXCEPTION 'Only students may book study rooms' USING ERRCODE='42501';
    END IF;
  ELSIF v_type IN ('THEORY','LAB') THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r USING(role_id)
        WHERE ur.user_id=NEW.user_id AND r.role_name='TEACHER') THEN
      RAISE EXCEPTION 'Only teachers may book theory or lab rooms' USING ERRCODE='42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown room type' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_booking_room_role BEFORE INSERT OR UPDATE OF user_id,room_id
ON bookings FOR EACH ROW EXECUTE FUNCTION guard_booking_room_role();


COMMIT;
