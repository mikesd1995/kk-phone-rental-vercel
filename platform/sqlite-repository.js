'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const COLLECTIONS = Object.freeze([
  'tasks', 'runs', 'policies', 'certificates', 'approvals', 'evidence', 'claims',
  'checkpoints', 'outbox', 'audit', 'idempotency', 'kill_switches', 'skills'
]);
const IMMUTABLE = new Set(['policies', 'audit', 'checkpoints', 'evidence', 'claims', 'skills', 'idempotency']);
const DOMAIN_IDS = Object.freeze({tasks:'task_id', runs:'run_id', policies:'policy_id', certificates:'certificate_id',
  approvals:'approval_id', evidence:'evidence_id', claims:'claim_id', checkpoints:'checkpoint_id', outbox:'outbox_id',
  audit:'event_id', skills:'skill_id'});
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MIGRATION_PATH = path.join(__dirname, 'sql', '001-control-plane.up.sql');

function fail(code) { const error = new Error(code); error.code = code; throw error; }
function validId(value) { return typeof value === 'string' && ID_PATTERN.test(value); }
function validateScope(scope) {
  if (!scope || !validId(scope.workspace_id) || !validId(scope.project_id)) fail('SCOPE_REQUIRED');
  return {workspace_id:scope.workspace_id, project_id:scope.project_id};
}
function validateCollection(collection) { if (!COLLECTIONS.includes(collection)) fail('COLLECTION_UNKNOWN'); }
function stableJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('RECORD_INVALID'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) fail('RECORD_INVALID');
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
}
function mapError(error) {
  if (error.code && error.code !== 'ERR_SQLITE_ERROR') return error;
  const known = ['HISTORICAL_DELETE_DENIED','IMMUTABLE_RECORD','IMMUTABLE_IDENTITY','TERMINAL_RECORD',
    'CERTIFICATE_AUTHORITY_IMMUTABLE','CERTIFICATE_REVOCATION_INVALID','RUN_TASK_SCOPE_MISMATCH',
    'APPROVAL_BINDING_IMMUTABLE','BUDGET_CONSTRAINT'];
  const code = known.find(value => String(error.message).includes(value)) ||
    (/UNIQUE constraint/.test(error.message) ? 'DUPLICATE_RECORD' :
      /FOREIGN KEY constraint/.test(error.message) ? 'REFERENCE_SCOPE_MISMATCH' :
        /CHECK constraint/.test(error.message) ? 'RECORD_CONSTRAINT' :
          /locked|busy/i.test(error.message) ? 'REPOSITORY_BUSY' : 'REPOSITORY_FAILURE');
  // Do not propagate driver error strings or record payloads to agent-visible logs.
  const clean = new Error(code); clean.code = code; return clean;
}

class SqliteRepository {
  #db;
  #transactionActive = false;
  #closed = false;

  constructor({filename} = {}) {
    if (typeof filename !== 'string' || !filename || filename.includes('\0') ||
      /^(?:[a-z][a-z\d+.-]*:\/\/|file:|\\\\|\/\/)/i.test(filename)) fail('LOCAL_DATABASE_REQUIRED');
    const {DatabaseSync} = require('node:sqlite');
    try {
      this.#db = new DatabaseSync(filename === ':memory:' ? filename : path.resolve(filename), {
        enableForeignKeyConstraints:true, enableDoubleQuotedStringLiterals:false, allowExtension:false,
        timeout:1000
      });
      this.#db.enableDefensive(true);
      this.#db.exec('PRAGMA foreign_keys = ON; PRAGMA trusted_schema = OFF; PRAGMA synchronous = FULL;');
      const migration = fs.readFileSync(MIGRATION_PATH, 'utf8');
      const hash = crypto.createHash('sha256').update(migration).digest('hex');
      const version = this.#db.prepare('PRAGMA user_version').get().user_version;
      if (version === 0) {
        const existing = this.#db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all();
        if (existing.length) fail('SCHEMA_UNKNOWN');
        // Keep schema creation and its identity record in one commit.
        this.#db.exec(migration.replace(/COMMIT;\s*$/, ''));
        this.#db.prepare('INSERT INTO platform_schema (version,migration_hash) VALUES (1,?)').run(hash);
        this.#db.exec('COMMIT');
      } else if (version !== 1) fail('SCHEMA_VERSION_UNSUPPORTED');
      const schema = this.#db.prepare('SELECT version,migration_hash FROM platform_schema').all();
      if (schema.length !== 1 || schema[0].version !== 1 || schema[0].migration_hash !== hash) fail('SCHEMA_INTEGRITY_FAILURE');
      if (this.#db.prepare('PRAGMA foreign_key_check').all().length) fail('SCHEMA_INTEGRITY_FAILURE');
      if (this.#db.prepare('PRAGMA quick_check').get().quick_check !== 'ok') fail('SCHEMA_INTEGRITY_FAILURE');
    } catch (error) {
      if (this.#db) { try { this.#db.close(); } catch {} }
      throw mapError(error);
    }
  }

  #assertOpen() { if (this.#closed) fail('REPOSITORY_CLOSED'); }
  #coordinates(collection, scope, id) {
    this.#assertOpen(); validateCollection(collection); const safeScope = validateScope(scope);
    if (id !== undefined && !validId(id)) fail('RECORD_ID_REQUIRED');
    return safeScope;
  }
  get(collection, scope, id) {
    const safe = this.#coordinates(collection, scope, id);
    if (id === undefined) fail('RECORD_ID_REQUIRED');
    try {
      const row = this.#db.prepare('SELECT payload FROM platform_records WHERE workspace_id=? AND project_id=? AND collection=? AND id=?')
        .get(safe.workspace_id, safe.project_id, collection, id);
      return row ? JSON.parse(row.payload) : null;
    } catch (error) { throw mapError(error); }
  }
  list(collection, scope) {
    const safe = this.#coordinates(collection, scope);
    try {
      return this.#db.prepare('SELECT payload FROM platform_records WHERE workspace_id=? AND project_id=? AND collection=? ORDER BY id')
        .all(safe.workspace_id, safe.project_id, collection).map(row => JSON.parse(row.payload));
    } catch (error) { throw mapError(error); }
  }
  #record(collection, scope, id, record, version) {
    const safe = this.#coordinates(collection, scope, id);
    if (!record || typeof record !== 'object' || Array.isArray(record)) fail('RECORD_INVALID');
    for (const [key, expected] of Object.entries({...safe, id})) {
      if (Object.hasOwn(record, key) && record[key] !== expected) fail('RECORD_SCOPE_MISMATCH');
    }
    const domainId = DOMAIN_IDS[collection];
    if (domainId && Object.hasOwn(record, domainId) && record[domainId] !== id) fail('IMMUTABLE_IDENTITY');
    const result = {...record, ...safe, id, version};
    let payload;
    try { payload = stableJson(result); } catch (error) {
      if (error.code) throw error; fail('RECORD_INVALID');
    }
    if (Buffer.byteLength(payload, 'utf8') > 1024 * 1024) fail('RECORD_TOO_LARGE');
    return {safe, payload, result:JSON.parse(payload)};
  }
  transaction(fn) {
    this.#assertOpen();
    if (typeof fn !== 'function' || fn.constructor.name === 'AsyncFunction') fail('SYNCHRONOUS_TRANSACTION_REQUIRED');
    if (this.#transactionActive) fail('NESTED_TRANSACTION_DENIED');
    this.#transactionActive = true;
    let active = true;
    let poisoned = null;
    const assertActive = () => { if (!active) fail('TRANSACTION_CLOSED'); };
    const operations = {
      get:(collection, scope, id) => { assertActive(); return this.get(collection, scope, id); },
      list:(collection, scope) => { assertActive(); return this.list(collection, scope); },
      insert:(collection, scope, id, record) => {
        assertActive();
        if (record && Object.hasOwn(record,'version') && record.version !== 1) fail('VERSION_CONFLICT');
        const built = this.#record(collection, scope, id, record, 1);
        this.#db.prepare('INSERT INTO platform_records (collection,workspace_id,project_id,id,version,payload) VALUES (?,?,?,?,1,?)')
          .run(collection, built.safe.workspace_id, built.safe.project_id, id, built.payload);
        const readback = this.get(collection, scope, id);
        if (stableJson(readback) !== built.payload) fail('READBACK_MISMATCH');
        return readback;
      },
      replace:(collection, scope, id, record, expectedVersion) => {
        assertActive();
        if (IMMUTABLE.has(collection)) fail('IMMUTABLE_RECORD');
        if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) fail('VERSION_REQUIRED');
        const current = this.get(collection, scope, id);
        if (!current) fail('RECORD_NOT_FOUND');
        if (current.version !== expectedVersion) fail('VERSION_CONFLICT');
        if (record && Object.hasOwn(record,'version') && ![expectedVersion, expectedVersion + 1].includes(record.version)) fail('VERSION_CONFLICT');
        const built = this.#record(collection, scope, id, record, expectedVersion + 1);
        for (const field of ['task_id','run_id','policy_id','policy_version','project_pack_version','created_at']) {
          if (Object.hasOwn(current,field) && current[field] !== built.result[field]) fail('IMMUTABLE_IDENTITY');
        }
        const change = this.#db.prepare('UPDATE platform_records SET version=?,payload=? WHERE workspace_id=? AND project_id=? AND collection=? AND id=? AND version=?')
          .run(expectedVersion + 1, built.payload, built.safe.workspace_id, built.safe.project_id, collection, id, expectedVersion);
        if (change.changes !== 1) fail('VERSION_CONFLICT');
        const readback = this.get(collection, scope, id);
        if (stableJson(readback) !== built.payload) fail('READBACK_MISMATCH');
        return readback;
      }
    };
    const tx = Object.freeze(Object.fromEntries(Object.entries(operations).map(([name, operation]) => [name, (...args) => {
      try { return operation(...args); } catch (error) { poisoned = mapError(error); throw poisoned; }
    }])));
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      const result = fn(tx);
      if (result && typeof result.then === 'function') { Promise.resolve(result).catch(() => {}); fail('SYNCHRONOUS_TRANSACTION_REQUIRED'); }
      if (poisoned) throw poisoned;
      this.#db.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.#db.exec('ROLLBACK'); } catch {}
      throw mapError(error);
    } finally { active = false; this.#transactionActive = false; }
  }
  close() {
    if (this.#transactionActive) fail('TRANSACTION_ACTIVE');
    if (!this.#closed) { this.#db.close(); this.#closed = true; }
  }
}

module.exports = {SqliteRepository, COLLECTIONS};
