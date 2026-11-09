BEGIN;
-- Resource constraints

ALTER TABLE resources
    ALTER COLUMN quantity SET NOT NULL,
    ALTER COLUMN resource_type SET NOT NULL;

-- chk_resources_quantity already exists from migration 007.

ALTER TABLE resources
    ADD CONSTRAINT chk_resources_status
    CHECK (status IN ('AVAILABLE', 'IN_USE', 'BROKEN', 'MAINTENANCE'));

ALTER TABLE resources
ALTER COLUMN status TYPE VARCHAR(20);

CREATE INDEX idx_resources_room_id
    ON resources (room_id);

CREATE INDEX idx_resources_room_status
    ON resources (room_id, status);
COMMIT;
