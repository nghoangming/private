-- Demo data: run manually after 001, 002 and 003 on the intended database.
-- BCrypt demo credentials: admin/Admin@123, teacher/Teacher@123, student/Student@123.
INSERT INTO users (user_code, full_name, email, password_hash) VALUES
    ('admin', 'Campus Administrator', 'admin@smartcampus.test', '$2a$10$48PFqODW9Q4032olxkmfF.b8VMeBb0n4ZiWHGItxChltfttwo613C'),
    ('teacher', 'Demo Teacher', 'teacher@smartcampus.test', '$2a$10$CfBEHolwhpQ54ZVKmhX7a.iT8t9C..orIxQi8NIZjYUGZYnFvdXdu'),
    ('student', 'Demo Student', 'student@smartcampus.test', '$2a$10$ZKEKKxUF533j3X8PuWKr5.QmOztpKGlJjnHlpuNQD8ktdgeNNi3rW')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT users.user_id, roles.role_id
FROM (VALUES ('admin', 'ADMIN'), ('teacher', 'TEACHER'), ('student', 'STUDENT')) AS demo(user_code, role_name)
JOIN users ON users.user_code = demo.user_code
JOIN roles ON roles.role_name = demo.role_name
ON CONFLICT DO NOTHING;

INSERT INTO rooms (room_code, name, location, status)
VALUES
    ('A101', 'Computer Lab A101', 'Building A - Floor 1', 'ACTIVE'),
    ('A102', 'Computer Lab A102', 'Building A - Floor 1', 'ACTIVE'),
    ('B201', 'Lecture Room B201', 'Building B - Floor 2', 'ACTIVE'),
    ('B202', 'Lecture Room B202', 'Building B - Floor 2', 'MAINTENANCE'),
    ('C301', 'Study Room C301', 'Building C - Floor 3', 'ACTIVE'),
    ('C302', 'Study Room C302', 'Building C - Floor 3', 'ACTIVE')
ON CONFLICT (room_code)
DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    status = EXCLUDED.status;

-- Seed 30 seats only for rooms with no seat layout yet.
INSERT INTO seats (room_id, seat_number, status)
SELECT r.room_id, n.seat_number, 'AVAILABLE'
FROM rooms r
CROSS JOIN generate_series(1, 30) AS n(seat_number)
WHERE r.room_code IN ('A101', 'A102', 'B201', 'B202', 'C301', 'C302')
  AND NOT EXISTS (SELECT 1 FROM seats s WHERE s.room_id = r.room_id);

-- Fixed equipment groups per room; seats are managed separately in seats.
-- Re-running this block preserves existing inventory quantities/status.
INSERT INTO resources(room_id,resource_name,resource_type,quantity,status)
SELECT r.room_id,d.resource_name,d.resource_type,d.quantity,'AVAILABLE'
FROM (VALUES
    ('A101','May tinh','COMPUTER',30),
    ('A101','May chieu','PROJECTOR',1),
    ('A102','May tinh','COMPUTER',30),
    ('A102','May chieu','PROJECTOR',1),
    ('B201','May chieu','PROJECTOR',1),
    ('B201','Micro','MICROPHONE',2),
    ('B202','May chieu','PROJECTOR',1),
    ('B202','Micro','MICROPHONE',2),
    ('C301','O cam dien','POWER_OUTLET',10),
    ('C302','O cam dien','POWER_OUTLET',10)
) AS d(room_code,resource_name,resource_type,quantity)
JOIN rooms r ON r.room_code=d.room_code
WHERE NOT EXISTS (
    SELECT 1 FROM resources existing WHERE existing.room_id=r.room_id
      AND existing.resource_name=d.resource_name AND existing.resource_type=d.resource_type
);

-- Fixed demonstration date: select 2026-10-16 in the UI to see these bookings.
-- Resolve identity IDs by natural keys instead of assuming IDs start at 1.
INSERT INTO bookings (user_id, room_id, start_time, end_time, status)
SELECT users.user_id, rooms.room_id, demo.start_time, demo.end_time, demo.status
FROM (VALUES
    ('teacher', 'A101', TIMESTAMPTZ '2026-10-16 08:00:00+07', TIMESTAMPTZ '2026-10-16 10:00:00+07', 'CONFIRMED'),
    ('teacher', 'A102', TIMESTAMPTZ '2026-10-16 09:00:00+07', TIMESTAMPTZ '2026-10-16 11:00:00+07', 'CONFIRMED'),
    ('teacher', 'B201', TIMESTAMPTZ '2026-10-16 13:00:00+07', TIMESTAMPTZ '2026-10-16 15:00:00+07', 'CONFIRMED'),
    ('student', 'C301', TIMESTAMPTZ '2026-10-16 08:00:00+07', TIMESTAMPTZ '2026-10-16 10:00:00+07', 'CANCELLED')
) AS demo(user_code, room_code, start_time, end_time, status)
JOIN users ON users.user_code = demo.user_code
JOIN rooms ON rooms.room_code = demo.room_code
WHERE NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.user_id = users.user_id AND bookings.room_id = rooms.room_id
      AND bookings.start_time = demo.start_time AND bookings.end_time = demo.end_time
      AND bookings.status = demo.status
);
