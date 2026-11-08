BEGIN;
ALTER TABLE class_sessions DROP CONSTRAINT chk_class_sessions_calendar_status;
ALTER TABLE class_sessions ADD COLUMN absence_previous_status VARCHAR(20);
ALTER TABLE class_sessions ADD CONSTRAINT chk_class_sessions_calendar_status
  CHECK (calendar_status IN ('SCHEDULED', 'MAKEUP', 'ABSENCE_PENDING', 'ABSENT'));
COMMIT;
