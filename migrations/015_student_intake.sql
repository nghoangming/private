BEGIN;
ALTER TABLE users ADD COLUMN gender VARCHAR(20);
ALTER TABLE users ADD COLUMN major VARCHAR(100);
CREATE TABLE student_intake (
    intake_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    birth_date DATE,
    gender VARCHAR(20),
    personal_email VARCHAR(100) NOT NULL,
    faculty_code CHAR(1) NOT NULL CHECK (faculty_code BETWEEN 'A' AND 'P'),
    major VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    user_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    UNIQUE(personal_email)
);
CREATE TABLE student_code_sequence (
    faculty_code CHAR(1) NOT NULL,
    code_year CHAR(2) NOT NULL,
    next_number INTEGER NOT NULL CHECK (next_number BETWEEN 1 AND 100000),
    PRIMARY KEY (faculty_code, code_year)
);
COMMIT;
