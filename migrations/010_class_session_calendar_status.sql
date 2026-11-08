BEGIN;
ALTER TABLE class_sessions
    ADD COLUMN calendar_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    ADD CONSTRAINT chk_class_sessions_calendar_status
        CHECK (calendar_status IN ('SCHEDULED', 'MAKEUP', 'ABSENT'));
COMMIT;
