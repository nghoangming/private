CREATE TABLE roles (
    role_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name VARCHAR(30) NOT NULL UNIQUE
);
CREATE TABLE permissions (
    permission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_name VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);
CREATE TABLE role_permissions (
     role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles(role_id),

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions(permission_id)
);
INSERT INTO roles (role_name)
VALUES
    ('ADMIN'),
    ('TEACHER'),
    ('STUDENT');

--Các quyền cho các role--
INSERT INTO permissions (permission_name)
VALUES
    ('VIEW_ROOMS'),
    ('MANAGE_ROOMS'),
    ('APPROVE_BOOKING'),
    ('MANAGE_USERS'),

    ('VIEW_RESOURCES'),
    ('MANAGE_RESOURCES'),

    ('VIEW_ATTENDANCE'),
    ('MANAGE_ATTENDANCE'),

    ('REPORT_INCIDENT'),
    ('VIEW_INCIDENTS'),
    ('MANAGE_INCIDENTS'),

    ('VIEW_OWN_SCHEDULE'),
	('VIEW_TEACHING_SCHEDULE'),
    ('CREATE_BOOKING'),
    ('SELECT_SEAT'),
    ('CHECK_IN_QR');

--Các quyền cho Admin--
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p
    ON p.permission_name IN (
        'VIEW_ROOMS',
        'MANAGE_ROOMS',
        'APPROVE_BOOKING',
        'MANAGE_USERS',
        'VIEW_RESOURCES',
        'MANAGE_RESOURCES',
        'VIEW_INCIDENTS',
        'MANAGE_INCIDENTS'
    )
WHERE r.role_name = 'ADMIN';

--Gán quyền cho Teacher--
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p
    ON p.permission_name IN (
        'VIEW_TEACHING_SCHEDULE',
        'VIEW_ROOMS',
        'CREATE_BOOKING',
        'SELECT_SEAT',
        'VIEW_ATTENDANCE',
        'REPORT_INCIDENT'
    )
WHERE r.role_name = 'TEACHER';

--Gán quyền cho Student--
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r
JOIN permissions p
    ON p.permission_name IN (
        'VIEW_OWN_SCHEDULE',
        'SELECT_SEAT',
        'CHECK_IN_QR',
        'REPORT_INCIDENT'
    )
WHERE r.role_name = 'STUDENT';
