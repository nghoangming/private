BEGIN;

ALTER TABLE student_intake ADD COLUMN entry_year SMALLINT;

-- Existing submissions had no entry year; preserve their previous code-year behavior.
UPDATE student_intake
SET entry_year = EXTRACT(YEAR FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::SMALLINT;

ALTER TABLE student_intake
    ALTER COLUMN entry_year SET NOT NULL,
    ADD CONSTRAINT chk_student_intake_entry_year CHECK (entry_year BETWEEN 2000 AND 2100);

COMMIT;
