-- 1. Add column cho bảng incidents và viết index cho cột status, room_id, reported_by để truy xuất nhanh hơn
ALTER TABLE incidents
ALTER COLUMN resource_id DROP NOT NULL;

ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS status VARCHAR(20)
NOT NULL DEFAULT 'OPEN';

ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS assigned_to BIGINT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE incidents
ADD CONSTRAINT fk_incidents_assigned_to
FOREIGN KEY (assigned_to)
REFERENCES users(user_id);

ALTER TABLE incidents
ADD CONSTRAINT chk_incidents_status
CHECK (
    status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')
);

CREATE INDEX IF NOT EXISTS idx_incidents_status
ON incidents(status);

CREATE INDEX IF NOT EXISTS idx_incidents_room
ON incidents(room_id);

CREATE INDEX IF NOT EXISTS idx_incidents_reported_by
ON incidents(reported_by);

--2.Add column cho bảng notifications để liên kết với incidents và bookings
-- Thêm cột notification_type để phân loại thông báo (ví dụ: INCIDENT, BOOKING, GENERAL)
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS notification_type VARCHAR(30);

--- Thêm cột related_incident_id để liên kết thông báo với một incident cụ thể
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS related_incident_id BIGINT;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS related_booking_id BIGINT;

--Tạo khóa ngoại cho các cột mới
ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_incident
FOREIGN KEY (related_incident_id)
REFERENCES incidents(incident_id);

ALTER TABLE notifications
ADD CONSTRAINT fk_notifications_booking
FOREIGN KEY (related_booking_id)
REFERENCES bookings(booking_id);

--Tạo index cho notification
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
ON notifications(user_id, is_read)
WHERE is_read = FALSE;

--3. Tạo bảng Auditlog để lưu trữ các thay đổi quan trọng trong hệ thống, bao gồm các hành động CRUD trên các bảng chính.
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
--Tạo index cho audit_logs để truy xuất nhanh hơn
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs(created_at DESC);

