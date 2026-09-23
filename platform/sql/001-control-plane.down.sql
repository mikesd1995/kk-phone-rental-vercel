-- Isolated empty-database rollback only. Preserve all history when any record exists.
BEGIN IMMEDIATE;
CREATE TEMP TABLE platform_rollback_guard (empty INTEGER CHECK (empty = 1));
INSERT INTO platform_rollback_guard SELECT CASE WHEN count(*) = 0 THEN 1 ELSE 0 END FROM platform_records;
DROP TABLE platform_records;
DROP TABLE platform_schema;
DROP TABLE platform_rollback_guard;
PRAGMA user_version = 0;
COMMIT;
