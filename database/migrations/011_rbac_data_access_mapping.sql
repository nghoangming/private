BEGIN;
SET LOCAL lock_timeout = '10s';
-- Transaction-local context must be set by a trusted authenticated backend.
-- Missing context fails closed; these helpers do not authenticate a user.
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS BIGINT
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id', true), '')::bigint
$$;
CREATE OR REPLACE FUNCTION app_current_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.role', true), '')
$$;
--1.Bổ sung bảng absence_requests để quản lý các yêu cầu vắng mặt của sinh viên và giáo viên
CREATE TABLE absence_requests (
    absence_request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    class_session_id BIGINT NOT NULL REFERENCES class_sessions(class_session_id),
    request_type VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by BIGINT REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_absence_request_type CHECK (request_type IN ('STUDENT', 'TEACHER')),
    CONSTRAINT chk_absence_request_status
        CHECK (status IN (
            'PENDING',
            'APPROVED',
            'REJECTED',
            'CANCELLED'
        ))
);

--2. Bổ sung phân quyền và permissions để quản lý incidents, notifications và audit_logs
INSERT INTO permissions (permission_name)
VALUES
    ('VIEW_OWN_INCIDENTS'),
    ('VIEW_NOTIFICATIONS'),
    ('MANAGE_NOTIFICATIONS'),
    ('VIEW_AUDIT_LOGS'),
    ('MANAGE_RBAC'),
    ('CREATE_OWN_ABSENCE_REQUEST'),
    ('VIEW_OWN_ABSENCE_REQUESTS'),    
    ('REVIEW_STUDENT_ABSENCE'),
    ('REVIEW_TEACHER_ABSENCE')
ON CONFLICT (permission_name) DO NOTHING;

--Gán cho ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'ADMIN'
AND p.permission_name IN (
    'VIEW_TEACHING_SCHEDULE',
    'VIEW_OWN_INCIDENTS',
    'VIEW_NOTIFICATIONS',
    'MANAGE_NOTIFICATIONS',
    'VIEW_AUDIT_LOGS',
    'MANAGE_RBAC',
    'CREATE_OWN_ABSENCE_REQUEST',
    'VIEW_OWN_ABSENCE_REQUESTS',
    'REVIEW_TEACHER_ABSENCE'
)
ON CONFLICT DO NOTHING;

--Gán cho TEACHER
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'TEACHER'
AND p.permission_name IN (
    'VIEW_OWN_INCIDENTS',
    'VIEW_NOTIFICATIONS',
    'CREATE_OWN_ABSENCE_REQUEST',
    'VIEW_OWN_ABSENCE_REQUESTS',
    'REVIEW_STUDENT_ABSENCE'
)
ON CONFLICT DO NOTHING;

--Gán cho STUDENT
INSERT INTO role_permissions (role_id, permission_id)
SELECT
    r.role_id,
    p.permission_id
FROM roles r
CROSS JOIN permissions p
WHERE r.role_name = 'STUDENT'
AND p.permission_name IN (
    'VIEW_OWN_INCIDENTS',
    'VIEW_NOTIFICATIONS',
    'CREATE_OWN_ABSENCE_REQUEST',
    'VIEW_OWN_ABSENCE_REQUESTS'
)
ON CONFLICT DO NOTHING;

--3. Data access mapping for RBAC
-- Phân quyền bảng absence_requests
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS absence_requests_select_policy
ON absence_requests;

CREATE POLICY absence_requests_select_policy
ON absence_requests
FOR SELECT
USING (
    user_id = app_current_user_id()

    OR (
        request_type = 'TEACHER'
        AND app_current_role() = 'ADMIN'
    )

    OR (
        request_type = 'STUDENT'
        AND app_current_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id =
                  absence_requests.class_session_id
              AND b.user_id = app_current_user_id()
        )
    )
);


DROP POLICY IF EXISTS absence_requests_insert_policy
ON absence_requests;

CREATE POLICY absence_requests_insert_policy
ON absence_requests
FOR INSERT
WITH CHECK (
    user_id = app_current_user_id()

    AND (
        (
            request_type = 'TEACHER'
            AND app_current_role() = 'TEACHER'
            AND EXISTS (
                SELECT 1
                FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
                WHERE cs.class_session_id =
                      absence_requests.class_session_id
                  AND b.user_id = app_current_user_id()
            )
        )

        OR (
            request_type = 'STUDENT'
            AND app_current_role() = 'STUDENT'
            AND EXISTS (
                SELECT 1
                FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
                WHERE cs.class_session_id =
                      absence_requests.class_session_id
            )
        )
    )
);


DROP POLICY IF EXISTS absence_requests_review_policy
ON absence_requests;

CREATE POLICY absence_requests_review_policy
ON absence_requests
FOR UPDATE
USING (
    (
        request_type = 'TEACHER'
        AND app_current_role() = 'ADMIN'
    )

    OR (
        request_type = 'STUDENT'
        AND app_current_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id =
                  absence_requests.class_session_id
              AND b.user_id = app_current_user_id()
        )
    )
)
WITH CHECK (
    (
        request_type = 'TEACHER'
        AND app_current_role() = 'ADMIN'
    )

    OR (
        request_type = 'STUDENT'
        AND app_current_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM class_sessions cs JOIN bookings b ON b.booking_id = cs.booking_id
            WHERE cs.class_session_id =
                  absence_requests.class_session_id
              AND b.user_id = app_current_user_id()
        )
    )
);

--Phần quyền bảng incidents
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS incidents_select_policy
ON incidents;

CREATE POLICY incidents_select_policy
ON incidents
FOR SELECT
USING (
    app_current_role() = 'ADMIN'
    OR reported_by = app_current_user_id()
);


DROP POLICY IF EXISTS incidents_insert_policy
ON incidents;

CREATE POLICY incidents_insert_policy
ON incidents
FOR INSERT
WITH CHECK (
    reported_by = app_current_user_id()
    AND app_current_role() IN ('ADMIN', 'TEACHER', 'STUDENT')
);


DROP POLICY IF EXISTS incidents_update_policy
ON incidents;

CREATE POLICY incidents_update_policy
ON incidents
FOR UPDATE
USING (
    app_current_role() = 'ADMIN'
)
WITH CHECK (
    app_current_role() = 'ADMIN'
);

--Phân quyền bảng notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_policy
ON notifications;

CREATE POLICY notifications_select_policy
ON notifications
FOR SELECT
USING (
    user_id = app_current_user_id()
);


DROP POLICY IF EXISTS notifications_update_policy
ON notifications;

CREATE POLICY notifications_update_policy
ON notifications
FOR UPDATE
USING (
    user_id = app_current_user_id()
)
WITH CHECK (
    user_id = app_current_user_id()
);

--Phân quyền bảng audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_select_policy
ON audit_logs;

CREATE POLICY audit_logs_select_policy
ON audit_logs
FOR SELECT
USING (
    app_current_role() = 'ADMIN'
);

--Kiểm tra chính sách RLS 
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN (
    'absence_requests',
    'incidents',
    'notifications',
    'audit_logs'
)
ORDER BY tablename, policyname;
COMMIT;
