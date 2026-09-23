-- Local-only Phase 0 control plane. No business tables, remote access or credentials.
-- JSON records remain behind the vendor-independent repository interface.
BEGIN IMMEDIATE;

CREATE TABLE platform_schema (
  version INTEGER PRIMARY KEY CHECK (version = 1),
  migration_hash TEXT NOT NULL CHECK (length(migration_hash) = 64)
) STRICT;

CREATE TABLE platform_records (
  collection TEXT NOT NULL CHECK (collection IN (
    'tasks','runs','policies','certificates','approvals','evidence','claims',
    'checkpoints','outbox','audit','idempotency','kill_switches','skills'
  )),
  workspace_id TEXT NOT NULL CHECK (length(workspace_id) BETWEEN 1 AND 128 AND trim(workspace_id) = workspace_id),
  project_id TEXT NOT NULL CHECK (length(project_id) BETWEEN 1 AND 128 AND trim(project_id) = project_id),
  id TEXT NOT NULL CHECK (length(id) BETWEEN 1 AND 128 AND trim(id) = id),
  version INTEGER NOT NULL CHECK (version >= 1),
  payload TEXT NOT NULL CHECK (json_valid(payload) AND json_type(payload) = 'object'),
  task_ref TEXT GENERATED ALWAYS AS (CASE WHEN collection IN ('runs','checkpoints','outbox','audit') THEN json_extract(payload,'$.task_id') END) STORED,
  task_collection TEXT GENERATED ALWAYS AS (CASE WHEN task_ref IS NOT NULL THEN 'tasks' END) STORED,
  run_ref TEXT GENERATED ALWAYS AS (CASE WHEN collection IN ('checkpoints','outbox','audit') THEN json_extract(payload,'$.run_id') WHEN collection = 'evidence' THEN json_extract(payload,'$.created_by_run_id') END) STORED,
  run_collection TEXT GENERATED ALWAYS AS (CASE WHEN run_ref IS NOT NULL THEN 'runs' END) STORED,
  operation TEXT GENERATED ALWAYS AS (CASE WHEN collection = 'idempotency' THEN json_extract(payload,'$.operation') END) STORED,
  idempotency_key TEXT GENERATED ALWAYS AS (CASE WHEN collection = 'idempotency' THEN json_extract(payload,'$.idempotency_key') END) STORED,
  PRIMARY KEY (workspace_id, project_id, collection, id),
  FOREIGN KEY (workspace_id, project_id, task_collection, task_ref)
    REFERENCES platform_records (workspace_id, project_id, collection, id) ON DELETE RESTRICT,
  FOREIGN KEY (workspace_id, project_id, run_collection, run_ref)
    REFERENCES platform_records (workspace_id, project_id, collection, id) ON DELETE RESTRICT,
  CHECK (json_type(payload,'$.workspace_id') IS 'text' AND json_extract(payload,'$.workspace_id') = workspace_id),
  CHECK (json_type(payload,'$.project_id') IS 'text' AND json_extract(payload,'$.project_id') = project_id),
  CHECK (json_type(payload,'$.id') IS 'text' AND json_extract(payload,'$.id') = id),
  CHECK (json_type(payload,'$.version') IS 'integer' AND json_extract(payload,'$.version') = version),
  CHECK (collection NOT IN ('runs','checkpoints') OR (task_ref IS NOT NULL AND length(task_ref) > 0)),
  CHECK (collection <> 'checkpoints' OR (run_ref IS NOT NULL AND length(run_ref) > 0)),
  CHECK (collection <> 'idempotency' OR (operation IS NOT NULL AND length(operation) > 0 AND idempotency_key IS NOT NULL AND length(idempotency_key) > 0)),
  CHECK (collection <> 'tasks' OR (json_type(payload,'$.status') IS 'text' AND json_extract(payload,'$.status') IN (
    'CREATED','VALIDATING','READY','PLANNING','RUNNING','WAITING_APPROVAL','RETRY_PENDING','EVALUATING','STAGED','SUCCEEDED','FAILED','REJECTED','CANCELLED','RECOVERING'
  ))),
  CHECK (collection <> 'runs' OR (json_type(payload,'$.status') IS 'text' AND json_extract(payload,'$.status') IN (
    'CREATED','RUNNING','WAITING_APPROVAL','RETRY_PENDING','EVALUATING','SUCCEEDED','FAILED','CANCELLED','RECOVERING','PARTIAL_RESULT','STAGED'
  ))),
  CHECK (json_extract(payload,'$.permission_ceiling') IS NULL OR json_extract(payload,'$.permission_ceiling') IN ('P0','P1','P2','P3','P4')),
  CHECK (json_extract(payload,'$.risk_class') IS NULL OR json_extract(payload,'$.risk_class') IN ('R0','R1','R2','R3')),
  CHECK (json_extract(payload,'$.max_steps') IS NULL OR (json_type(payload,'$.max_steps') = 'integer' AND json_extract(payload,'$.max_steps') >= 0)),
  CHECK (json_extract(payload,'$.max_tool_calls') IS NULL OR (json_type(payload,'$.max_tool_calls') = 'integer' AND json_extract(payload,'$.max_tool_calls') >= 0)),
  CHECK (json_extract(payload,'$.max_retries') IS NULL OR (json_type(payload,'$.max_retries') = 'integer' AND json_extract(payload,'$.max_retries') >= 0)),
  CHECK (json_extract(payload,'$.max_cost') IS NULL OR (json_type(payload,'$.max_cost') IN ('integer','real') AND json_extract(payload,'$.max_cost') >= 0))
) STRICT;

CREATE UNIQUE INDEX platform_idempotency_scope
  ON platform_records (workspace_id, project_id, operation, idempotency_key)
  WHERE collection = 'idempotency';

CREATE UNIQUE INDEX platform_audit_sequence_scope
  ON platform_records (workspace_id, project_id, json_extract(payload,'$.sequence'))
  WHERE collection = 'audit' AND json_extract(payload,'$.sequence') IS NOT NULL;

CREATE UNIQUE INDEX platform_approval_nonce_scope
  ON platform_records (workspace_id, project_id, json_extract(payload,'$.nonce'))
  WHERE collection = 'approvals' AND json_extract(payload,'$.nonce') IS NOT NULL;

CREATE TRIGGER platform_approval_binding BEFORE UPDATE ON platform_records
WHEN OLD.collection = 'approvals' AND (
  json_remove(NEW.payload,'$.version','$.status','$.consumed_at') <> json_remove(OLD.payload,'$.version','$.status','$.consumed_at')
  OR json_extract(OLD.payload,'$.consumed_at') IS NOT NULL
)
BEGIN SELECT RAISE(ABORT, 'APPROVAL_BINDING_IMMUTABLE'); END;

CREATE TRIGGER platform_budget_insert BEFORE INSERT ON platform_records
WHEN EXISTS (SELECT 1 FROM json_tree(NEW.payload) WHERE path IN ('$.budget','$.used','$.allocated')
  AND (type NOT IN ('integer','real') OR atom < 0 OR (key <> 'cost' AND type <> 'integer')))
BEGIN SELECT RAISE(ABORT, 'BUDGET_CONSTRAINT'); END;

CREATE TRIGGER platform_budget_update BEFORE UPDATE ON platform_records
WHEN EXISTS (SELECT 1 FROM json_tree(NEW.payload) WHERE path IN ('$.budget','$.used','$.allocated')
  AND (type NOT IN ('integer','real') OR atom < 0 OR (key <> 'cost' AND type <> 'integer')))
BEGIN SELECT RAISE(ABORT, 'BUDGET_CONSTRAINT'); END;

CREATE TRIGGER platform_no_delete BEFORE DELETE ON platform_records
BEGIN SELECT RAISE(ABORT, 'HISTORICAL_DELETE_DENIED'); END;

CREATE TRIGGER platform_immutable_records BEFORE UPDATE ON platform_records
WHEN OLD.collection IN ('policies','audit','checkpoints','evidence','claims','skills','idempotency')
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_RECORD'); END;

CREATE TRIGGER platform_immutable_identity BEFORE UPDATE ON platform_records
WHEN NEW.collection <> OLD.collection OR NEW.workspace_id <> OLD.workspace_id
  OR NEW.project_id <> OLD.project_id OR NEW.id <> OLD.id OR NEW.version <> OLD.version + 1
BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_IDENTITY'); END;

CREATE TRIGGER platform_terminal_task BEFORE UPDATE ON platform_records
WHEN OLD.collection = 'tasks' AND json_extract(OLD.payload,'$.status') IN ('SUCCEEDED','FAILED','REJECTED','CANCELLED')
BEGIN SELECT RAISE(ABORT, 'TERMINAL_RECORD'); END;

CREATE TRIGGER platform_certificate_authority BEFORE UPDATE ON platform_records
WHEN OLD.collection = 'certificates' AND json_remove(NEW.payload,'$.version','$.revoked_at','$.revoked_by','$.revocation_reason')
  <> json_remove(OLD.payload,'$.version','$.revoked_at','$.revoked_by','$.revocation_reason')
BEGIN SELECT RAISE(ABORT, 'CERTIFICATE_AUTHORITY_IMMUTABLE'); END;

CREATE TRIGGER platform_certificate_revocation BEFORE UPDATE ON platform_records
WHEN OLD.collection = 'certificates' AND (
  json_extract(OLD.payload,'$.revoked_at') IS NOT NULL
  OR json_type(NEW.payload,'$.revoked_at') IS NOT 'text'
  OR json_type(NEW.payload,'$.revoked_by') IS NOT 'text'
  OR json_type(NEW.payload,'$.revocation_reason') IS NOT 'text'
)
BEGIN SELECT RAISE(ABORT, 'CERTIFICATE_REVOCATION_INVALID'); END;

CREATE TRIGGER platform_run_task_insert BEFORE INSERT ON platform_records
WHEN NEW.task_ref IS NOT NULL AND NEW.run_ref IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM platform_records r WHERE r.workspace_id = NEW.workspace_id AND r.project_id = NEW.project_id
    AND r.collection = 'runs' AND r.id = NEW.run_ref AND json_extract(r.payload,'$.task_id') = NEW.task_ref
)
BEGIN SELECT RAISE(ABORT, 'RUN_TASK_SCOPE_MISMATCH'); END;

CREATE TRIGGER platform_run_task_update BEFORE UPDATE ON platform_records
WHEN NEW.task_ref IS NOT NULL AND NEW.run_ref IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM platform_records r WHERE r.workspace_id = NEW.workspace_id AND r.project_id = NEW.project_id
    AND r.collection = 'runs' AND r.id = NEW.run_ref AND json_extract(r.payload,'$.task_id') = NEW.task_ref
)
BEGIN SELECT RAISE(ABORT, 'RUN_TASK_SCOPE_MISMATCH'); END;

PRAGMA user_version = 1;
COMMIT;
