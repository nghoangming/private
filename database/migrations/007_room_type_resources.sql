BEGIN;

-- 1. ADD ROOM TYPE TO ROOMS
ALTER TABLE rooms
ADD COLUMN room_type VARCHAR(20);

ALTER TABLE rooms
ADD CONSTRAINT chk_rooms_room_type
CHECK (room_type IN ('THEORY', 'PRACTICE', 'SELF_STUDY'));

-- 2. CLASSIFY EXISTING ROOMS 
UPDATE rooms
SET room_type = CASE
    WHEN room_code LIKE 'A%' THEN 'PRACTICE'
    WHEN room_code LIKE 'B%' THEN 'THEORY'
    WHEN room_code LIKE 'C%' THEN 'SELF_STUDY'
END
WHERE room_type IS NULL;

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
ALTER COLUMN room_type SET NOT NULL;

-- 5. AUTO CLASSIFY NEW ROOMS
CREATE OR REPLACE FUNCTION set_room_type_by_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.room_type := CASE
        WHEN NEW.room_code LIKE 'A%' THEN 'PRACTICE'
        WHEN NEW.room_code LIKE 'B%' THEN 'THEORY'
        WHEN NEW.room_code LIKE 'C%' THEN 'SELF_STUDY'
        ELSE NULL
    END;

    IF NEW.room_type IS NULL THEN
        RAISE EXCEPTION
            'Invalid room code: %. Room code must start with A, B or C.',
            NEW.room_code;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_room_type
BEFORE INSERT OR UPDATE OF room_code, room_type
ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_room_type_by_code();

COMMIT;
