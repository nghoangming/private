BEGIN;
SET LOCAL lock_timeout = '10s';
-- Fail on inconsistent legacy data; never move equipment or rewrite incident history.
ALTER TABLE resources ADD CONSTRAINT uq_resources_id_room UNIQUE(resource_id,room_id);
ALTER TABLE incidents ADD CONSTRAINT fk_incident_resource_room
 FOREIGN KEY(resource_id,room_id) REFERENCES resources(resource_id,room_id);
-- MATCH SIMPLE preserves general room incidents with resource_id NULL.
CREATE INDEX idx_incidents_resource_room ON incidents(resource_id,room_id);
COMMENT ON TABLE resources IS 'Fixed equipment groups per room. Quantity is installed inventory, not working-device count. Seats are managed separately.';
COMMENT ON COLUMN resources.status IS 'Group-level status; individual failures are recorded as incidents, without decrementing quantity.';
COMMENT ON COLUMN incidents.resource_id IS 'Optional for general room incidents. Selected resource must belong to incidents.room_id.';
COMMIT;
