BEGIN;

SET LOCAL lock_timeout = '10s';

-- 1. Add composite unique keys for referential integrity
-- A class session must be associated with exactly one booking.
ALTER TABLE class_sessions
    ADD CONSTRAINT uq_class_sessions_id_booking
    UNIQUE (class_session_id, booking_id);

-- A seat reservation must identify its session and student.
ALTER TABLE seat_reservations
    ADD CONSTRAINT uq_seat_reservations_id_session_user
    UNIQUE (seat_reservation_id, class_session_id, user_id);

-- A check-in must identify its booking and student.
ALTER TABLE checkins
    ADD CONSTRAINT uq_checkins_id_booking_user
    UNIQUE (checkin_id, booking_id, user_id);


-- 2. Add columns to the existing attendance table
ALTER TABLE attendance
    ADD COLUMN class_session_id BIGINT,
    ADD COLUMN seat_reservation_id BIGINT,
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancelled_by BIGINT REFERENCES users(user_id),
    ADD COLUMN evaluated_by BIGINT,
    ADD COLUMN evaluation_note TEXT,
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP;


-- 3. Validate legacy attendance rows before backfilling
DO $$
BEGIN
    -- Every old attendance row must map to a class session
    -- and a confirmed seat reservation for the same student.
    IF EXISTS (
        SELECT 1
        FROM attendance a
        LEFT JOIN class_sessions cs
            ON cs.booking_id = a.booking_id
        LEFT JOIN seat_reservations sr
            ON sr.class_session_id = cs.class_session_id
           AND sr.user_id = a.user_id
           AND sr.status = 'CONFIRMED'
        WHERE cs.class_session_id IS NULL
           OR sr.seat_reservation_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 008 stopped: legacy attendance rows do not map to a class session and confirmed seat reservation. Review attendance, class_sessions and seat_reservations before retrying.';
    END IF;

    -- Existing check-in must belong to the same booking and student.
    IF EXISTS (
        SELECT 1
        FROM attendance a
        LEFT JOIN checkins c
            ON c.checkin_id = a.checkin_id
           AND c.booking_id = a.booking_id
           AND c.user_id = a.user_id
        WHERE c.checkin_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Migration 008 stopped: an attendance check-in does not match its booking and student.';
    END IF;

    -- Do not silently reinterpret unknown legacy statuses.
    IF EXISTS (
        SELECT 1
        FROM attendance
        WHERE attendance_status IS NOT NULL
          AND upper(btrim(attendance_status))
              NOT IN ('PENDING', 'PRESENT', 'ABSENT', 'LATE', 'EXCUSED')
    ) THEN
        RAISE EXCEPTION
            'Migration 008 stopped: unknown legacy attendance_status. Normalize existing values before retrying.';
    END IF;
END $$;


-- 4. Backfill class_session_id and seat_reservation_id
UPDATE attendance a
SET
    class_session_id = cs.class_session_id,
    seat_reservation_id = sr.seat_reservation_id
FROM class_sessions cs
JOIN seat_reservations sr
    ON sr.class_session_id = cs.class_session_id
   AND sr.status = 'CONFIRMED'
WHERE cs.booking_id = a.booking_id
  AND sr.user_id = a.user_id;


-- Normalize old status values and fill missing timestamps.
UPDATE attendance a
SET
    attendance_status = CASE
        WHEN a.attendance_status IS NULL
             AND a.checkin_id IS NOT NULL
            THEN 'PRESENT'
        WHEN a.attendance_status IS NULL
            THEN 'PENDING'
        ELSE upper(btrim(a.attendance_status))
    END,
    check_in_at = COALESCE(a.check_in_at, c.checked_in_at)
FROM checkins c
WHERE c.checkin_id = a.checkin_id;

-- Rows without a check-in may still have a NULL legacy status.
UPDATE attendance
SET attendance_status = 'PENDING'
WHERE attendance_status IS NULL;


-- 5. Apply NOT NULL and status constraints
ALTER TABLE attendance
    ALTER COLUMN class_session_id SET NOT NULL,
    ALTER COLUMN seat_reservation_id SET NOT NULL,
    ALTER COLUMN attendance_status SET NOT NULL,
    ALTER COLUMN attendance_status SET DEFAULT 'PENDING',
    ALTER COLUMN checkin_id DROP NOT NULL;

ALTER TABLE attendance
    ALTER COLUMN attendance_status TYPE VARCHAR(20);

ALTER TABLE attendance
    ADD CONSTRAINT chk_attendance_status
    CHECK (
        attendance_status IN (
            'PENDING',
            'PRESENT',
            'LATE',
            'ABSENT',
            'EXCUSED'
        )
    );


-- 6. Foreign keys to enforce consistent relationships
ALTER TABLE attendance
    ADD CONSTRAINT fk_attendance_session_booking
        FOREIGN KEY (class_session_id, booking_id)
        REFERENCES class_sessions (class_session_id, booking_id),

    ADD CONSTRAINT fk_attendance_seat_session_user
        FOREIGN KEY (
            seat_reservation_id,
            class_session_id,
            user_id
        )
        REFERENCES seat_reservations (
            seat_reservation_id,
            class_session_id,
            user_id
        ),

    ADD CONSTRAINT fk_attendance_checkin_booking_user
        FOREIGN KEY (checkin_id, booking_id, user_id)
        REFERENCES checkins (checkin_id, booking_id, user_id),

    ADD CONSTRAINT fk_attendance_evaluated_by
        FOREIGN KEY (evaluated_by)
        REFERENCES users (user_id);


ALTER TABLE attendance ADD CONSTRAINT chk_attendance_cancellation CHECK (cancelled_at IS NULL OR cancelled_by IS NOT NULL);

-- 7. Prevent duplicate attendance per student per session
ALTER TABLE attendance
    ADD CONSTRAINT uq_attendance_session_user
    UNIQUE (class_session_id, user_id);


-- 8. Indexes for common attendance queries
CREATE INDEX idx_attendance_session_status
    ON attendance (class_session_id, attendance_status);

CREATE INDEX idx_attendance_user_created_at
    ON attendance (user_id, created_at DESC);

CREATE INDEX idx_attendance_evaluated_by
    ON attendance (evaluated_by)
    WHERE evaluated_by IS NOT NULL;

COMMIT;