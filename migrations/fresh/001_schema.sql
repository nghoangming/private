-- Fresh PostgreSQL installation only. Run against an empty smart_campus database.
-- Do not combine this baseline with the historical 001-016 migrations.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  faculty VARCHAR(100),
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  birth_date DATE,
  phone VARCHAR(20),
  personal_email VARCHAR(100),
  class_name VARCHAR(60),
  entry_year SMALLINT CHECK (entry_year IS NULL OR entry_year BETWEEN 1900 AND 2100),
  gender VARCHAR(20)
);
CREATE INDEX idx_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_user_code_lower ON users (lower(user_code));
CREATE INDEX idx_users_faculty ON users (faculty);

CREATE TABLE roles (role_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, role_name VARCHAR(30) NOT NULL UNIQUE);
CREATE TABLE permissions (permission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, permission_name VARCHAR(50) NOT NULL UNIQUE);
CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  role_id BIGINT NOT NULL REFERENCES roles(role_id),
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX idx_user_roles_role ON user_roles (role_id);
CREATE TABLE role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(role_id),
  permission_id BIGINT NOT NULL REFERENCES permissions(permission_id),
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE user_invites (
  invite_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE rooms (
  room_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('THEORY', 'LAB', 'STUDY'))
);
CREATE INDEX idx_rooms_status_location ON rooms (status, location);
CREATE TABLE seats (
  seat_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(room_id),
  seat_number INT NOT NULL CHECK (seat_number > 0),
  status VARCHAR(20) NOT NULL,
  CONSTRAINT uq_seats_room_number UNIQUE (room_id, seat_number),
  CONSTRAINT uq_seats_id_room UNIQUE (seat_id, room_id)
);

CREATE TABLE bookings (
  booking_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  room_id BIGINT NOT NULL REFERENCES rooms(room_id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_bookings_time_range CHECK (start_time < end_time),
  CONSTRAINT uq_bookings_id_room_time UNIQUE (booking_id, room_id, start_time, end_time),
  CONSTRAINT ex_bookings_room_active_time EXCLUDE USING gist
    (room_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
    WHERE (status IN ('PENDING','CONFIRMED'))
);
CREATE INDEX idx_bookings_room_active_time ON bookings (room_id, start_time, end_time) WHERE upper(status) NOT IN ('CANCELLED','CANCELED','REJECTED');
CREATE INDEX idx_bookings_room_status_time ON bookings (room_id, status, start_time, end_time);
CREATE INDEX idx_bookings_status_created_at ON bookings (status, created_at DESC);
CREATE INDEX idx_bookings_created_at ON bookings (created_at DESC);
CREATE INDEX idx_bookings_user_created_at ON bookings (user_id, created_at DESC);

CREATE TABLE class_sessions (
  class_session_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL UNIQUE,
  course_code VARCHAR(30) NOT NULL CHECK (btrim(course_code) <> ''),
  title VARCHAR(150) NOT NULL CHECK (btrim(title) <> ''),
  room_id BIGINT NOT NULL REFERENCES rooms(room_id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  calendar_status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (calendar_status IN ('SCHEDULED','MAKEUP','ABSENCE_PENDING','ABSENT')),
  absence_previous_status VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_class_sessions_id_room UNIQUE (class_session_id, room_id),
  CONSTRAINT chk_class_sessions_time_range CHECK (start_time < end_time),
  CONSTRAINT fk_class_sessions_booking_room_time FOREIGN KEY (booking_id, room_id, start_time, end_time)
    REFERENCES bookings (booking_id, room_id, start_time, end_time)
);
CREATE INDEX idx_class_sessions_room_time ON class_sessions (room_id, start_time, end_time);
CREATE INDEX idx_class_sessions_start_time ON class_sessions (start_time);

-- Retained for compatibility with the original schema. New seat choices use seat_reservations.
CREATE TABLE booking_seats (
  booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
  seat_id BIGINT NOT NULL REFERENCES seats(seat_id),
  PRIMARY KEY (booking_id, seat_id)
);
CREATE TABLE seat_reservations (
  seat_reservation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_session_id BIGINT NOT NULL,
  seat_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  room_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_seat_reservations_session_room FOREIGN KEY (class_session_id, room_id) REFERENCES class_sessions(class_session_id, room_id),
  CONSTRAINT fk_seat_reservations_seat_room FOREIGN KEY (seat_id, room_id) REFERENCES seats(seat_id, room_id)
);
CREATE UNIQUE INDEX uq_seat_reservations_active_seat ON seat_reservations (class_session_id, seat_id) WHERE status = 'CONFIRMED';
CREATE UNIQUE INDEX uq_seat_reservations_active_user ON seat_reservations (class_session_id, user_id) WHERE status = 'CONFIRMED';
CREATE INDEX idx_seat_reservations_session_status ON seat_reservations (class_session_id, status);
CREATE INDEX idx_seat_reservations_user_status ON seat_reservations (user_id, status, created_at DESC);
CREATE INDEX idx_seat_reservations_seat_room ON seat_reservations (seat_id, room_id);

CREATE TABLE checkins (
  checkin_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE attendance (
  attendance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(booking_id),
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  checkin_id BIGINT NOT NULL REFERENCES checkins(checkin_id),
  attendance_status VARCHAR(10),
  check_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by BIGINT REFERENCES users(user_id)
);
CREATE UNIQUE INDEX uq_attendance_booking_user_active ON attendance(booking_id, user_id) WHERE attendance_status = 'PRESENT';
CREATE TABLE class_session_qr_tokens (
  token_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  class_session_id BIGINT NOT NULL REFERENCES class_sessions(class_session_id),
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by BIGINT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_class_session_qr_tokens_session ON class_session_qr_tokens(class_session_id, expires_at DESC);

CREATE TABLE notifications (
  notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id),
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE resources (
  resource_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(room_id),
  resource_name VARCHAR(20) NOT NULL,
  resource_type VARCHAR(20),
  quantity INT,
  status VARCHAR(10)
);
CREATE TABLE incidents (
  incident_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id BIGINT NOT NULL REFERENCES rooms(room_id),
  resource_id BIGINT NOT NULL REFERENCES resources(resource_id),
  reported_by BIGINT NOT NULL REFERENCES users(user_id),
  incident_type VARCHAR(30),
  description TEXT,
  occurred_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE TABLE student_intake (
  intake_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  birth_date DATE,
  gender VARCHAR(20),
  personal_email VARCHAR(100) NOT NULL UNIQUE,
  faculty_code CHAR(1) NOT NULL CHECK (faculty_code BETWEEN 'A' AND 'P'),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  user_id BIGINT REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMPTZ
);
CREATE TABLE student_code_sequence (
  faculty_code CHAR(1) NOT NULL,
  code_year CHAR(2) NOT NULL,
  next_number INTEGER NOT NULL CHECK (next_number BETWEEN 1 AND 100000),
  PRIMARY KEY (faculty_code, code_year)
);

INSERT INTO roles(role_name) VALUES ('ADMIN'),('TEACHER'),('STUDENT');
INSERT INTO permissions(permission_name) VALUES
 ('VIEW_ROOMS'),('MANAGE_ROOMS'),('APPROVE_BOOKING'),('MANAGE_USERS'),
 ('VIEW_RESOURCES'),('MANAGE_RESOURCES'),('VIEW_ATTENDANCE'),('MANAGE_ATTENDANCE'),
 ('REPORT_INCIDENT'),('VIEW_INCIDENTS'),('MANAGE_INCIDENTS'),('VIEW_OWN_SCHEDULE'),
 ('VIEW_TEACHING_SCHEDULE'),('CREATE_BOOKING'),('SELECT_SEAT'),('CHECK_IN_QR');
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.role_id, p.permission_id FROM roles r CROSS JOIN permissions p
WHERE (r.role_name = 'ADMIN' AND p.permission_name IN ('VIEW_ROOMS','MANAGE_ROOMS','APPROVE_BOOKING','MANAGE_USERS','VIEW_RESOURCES','MANAGE_RESOURCES','VIEW_INCIDENTS','MANAGE_INCIDENTS'))
   OR (r.role_name = 'TEACHER' AND p.permission_name IN ('VIEW_TEACHING_SCHEDULE','VIEW_ROOMS','CREATE_BOOKING','SELECT_SEAT','VIEW_ATTENDANCE','REPORT_INCIDENT'))
   OR (r.role_name = 'STUDENT' AND p.permission_name IN ('VIEW_OWN_SCHEDULE','SELECT_SEAT','CHECK_IN_QR','REPORT_INCIDENT'));
COMMIT;
