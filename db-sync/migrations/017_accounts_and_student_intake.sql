-- Profile, email activation and student intake from the private DB.
BEGIN;
ALTER TABLE users
  ADD COLUMN faculty VARCHAR(100),
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN birth_date DATE,
  ADD COLUMN phone VARCHAR(20),
  ADD COLUMN personal_email VARCHAR(100),
  ADD COLUMN class_name VARCHAR(60),
  ADD COLUMN entry_year SMALLINT,
  ADD COLUMN gender VARCHAR(20),
  ADD CONSTRAINT users_entry_year_range CHECK (entry_year IS NULL OR entry_year BETWEEN 1900 AND 2100);
CREATE INDEX idx_users_faculty ON users(faculty);
CREATE TABLE user_invites (
  invite_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX idx_user_invites_user ON user_invites(user_id);
CREATE TABLE faculties (
  faculty_code CHAR(1) PRIMARY KEY CHECK (faculty_code BETWEEN 'A' AND 'P'),
  faculty_name VARCHAR(100) NOT NULL UNIQUE
);
INSERT INTO faculties(faculty_code,faculty_name) VALUES
  ('A','Công nghệ thông tin'),('B','Dược'),('C','Điện - Điện tử'),('D','Kế toán'),
  ('E','Khoa học thể thao'),('F','Khoa học ứng dụng'),('G','Ngoại ngữ'),
  ('H','Kỹ thuật công trình'),('I','Luật'),('J','Mỹ thuật công nghiệp'),
  ('K','Quản trị kinh doanh'),('L','Lao động và Công đoàn'),
  ('M','Khoa học xã hội và Nhân văn'),('N','Môi trường - Bảo hộ lao động'),
  ('O','Tài chính - Ngân hàng'),('P','Toán - Thống kê');
CREATE TABLE student_intake (
  intake_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  birth_date DATE,
  gender VARCHAR(20) CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER')),
  personal_email VARCHAR(100) NOT NULL UNIQUE,
  faculty_code CHAR(1) NOT NULL REFERENCES faculties(faculty_code),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  user_id BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT chk_student_intake_review CHECK (
    (status='PENDING' AND user_id IS NULL AND reviewed_at IS NULL)
    OR (status='APPROVED' AND user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (status='REJECTED' AND user_id IS NULL AND reviewed_at IS NOT NULL))
);
CREATE INDEX idx_student_intake_status_created ON student_intake(status,created_at DESC);
CREATE TABLE student_code_sequence (
  faculty_code CHAR(1) NOT NULL REFERENCES faculties(faculty_code),
  code_year CHAR(2) NOT NULL,
  next_number INTEGER NOT NULL CHECK (next_number BETWEEN 1 AND 100000),
  PRIMARY KEY (faculty_code,code_year)
);
COMMIT;
