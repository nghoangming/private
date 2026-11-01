-- Reservation is stored in the existing bookings table (do not create a second table).
-- Apply once, after 001-004. Run the whole file, not individual statements.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE EXTENSION IF NOT EXISTS btree_gist;
LOCK TABLE bookings IN ACCESS EXCLUSIVE MODE;

-- Preserve legacy rows while aligning status values with the OpenAPI contract.
UPDATE bookings
SET status = CASE upper(btrim(status))
    WHEN 'APPROVED' THEN 'CONFIRMED'
    WHEN 'CANCELED' THEN 'CANCELLED'
    ELSE upper(btrim(status))
END
WHERE status IS DISTINCT FROM CASE upper(btrim(status))
    WHEN 'APPROVED' THEN 'CONFIRMED'
    WHEN 'CANCELED' THEN 'CANCELLED'
    ELSE upper(btrim(status))
END;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE status NOT IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED')
    ) THEN
        RAISE EXCEPTION 'Unknown booking status. Review existing rows before migration 005.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM bookings first_booking
        JOIN bookings second_booking
          ON first_booking.room_id = second_booking.room_id
         AND first_booking.booking_id < second_booking.booking_id
         AND first_booking.start_time < second_booking.end_time
         AND first_booking.end_time > second_booking.start_time
        WHERE first_booking.status IN ('PENDING', 'CONFIRMED')
          AND second_booking.status IN ('PENDING', 'CONFIRMED')
    ) THEN
        RAISE EXCEPTION 'Active bookings overlap. Resolve the conflicting rows before migration 005; no rows were deleted.';
    END IF;
END $$;

-- User/Room foreign keys and NOT NULL columns already exist in migration 001.
-- start_time < end_time is already enforced by migration 003.
ALTER TABLE bookings
    ALTER COLUMN status SET DEFAULT 'PENDING',
    ADD CONSTRAINT chk_bookings_status
        CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED')),
    ADD CONSTRAINT ex_bookings_room_active_time
        EXCLUDE USING gist (
            room_id WITH =,
            tstzrange(start_time, end_time, '[)') WITH &&
        ) WHERE (status IN ('PENDING', 'CONFIRMED'));

-- [) allows adjacent bookings (08:00-10:00 followed by 10:00-12:00).
-- The exclusion constraint protects INSERT and UPDATE, including concurrent writers.
CREATE INDEX idx_bookings_room_status_time
    ON bookings (room_id, status, start_time, end_time);
CREATE INDEX idx_bookings_status_created_at
    ON bookings (status, created_at DESC);
CREATE INDEX idx_bookings_created_at
    ON bookings (created_at DESC);
CREATE INDEX idx_bookings_user_created_at
    ON bookings (user_id, created_at DESC);

COMMENT ON TABLE bookings IS 'Room reservations; active PENDING/CONFIRMED rows cannot overlap for the same room.';
COMMENT ON COLUMN bookings.status IS 'PENDING, CONFIRMED, CANCELLED, REJECTED. Legacy APPROVED is migrated to CONFIRMED.';

COMMIT;
