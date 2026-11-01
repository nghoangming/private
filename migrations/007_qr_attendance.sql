-- Apply after 006 on the existing smart_campus database.
BEGIN;
CREATE TABLE class_session_qr_tokens (
    token_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_session_id BIGINT NOT NULL REFERENCES class_sessions(class_session_id),
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by BIGINT NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_class_session_qr_tokens_session ON class_session_qr_tokens(class_session_id, expires_at DESC);
CREATE UNIQUE INDEX uq_attendance_booking_user ON attendance(booking_id, user_id);
COMMIT;
