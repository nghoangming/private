BEGIN;

-- One active seat per student in each class session. A student may reserve
-- another seat in a different class session without cancelling this one.
DROP INDEX IF EXISTS uq_seat_reservations_active_user;
CREATE UNIQUE INDEX uq_seat_reservations_active_user
    ON seat_reservations (class_session_id, user_id)
    WHERE status = 'CONFIRMED';

COMMENT ON INDEX uq_seat_reservations_active_user IS
    'One confirmed seat per student per class session';

COMMIT;
