'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');
const {SqliteRepository} = require('../../platform/sqlite-repository');
const scope = Object.freeze({workspace_id:'workspace-a', project_id:'project-a'});
const other = Object.freeze({workspace_id:'workspace-a', project_id:'project-b'});
const up = fs.readFileSync(path.join(__dirname,'../../platform/sql/001-control-plane.up.sql'),'utf8');
const down = fs.readFileSync(path.join(__dirname,'../../platform/sql/001-control-plane.down.sql'),'utf8');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'phase0-repository-'));
  const filename = path.join(directory,'isolated.sqlite');
  const repository = new SqliteRepository({filename});
  t.after(() => { repository.close(); fs.rmSync(directory,{recursive:true,force:true}); });
  return {repository, filename};
}
function task(repository, id='task-a', target=scope, more={}) {
  return repository.transaction(tx => tx.insert('tasks',target,id,{task_id:id,status:'CREATED',...more}));
}
function rawInsert(db,collection,target,id,record) {
  const payload = {workspace_id:target.workspace_id,project_id:target.project_id,id,version:1,...record};
  return db.prepare('INSERT INTO platform_records (collection,workspace_id,project_id,id,version,payload) VALUES (?,?,?,?,1,?)')
    .run(collection,target.workspace_id,target.project_id,id,JSON.stringify(payload));
}

test('repository commits durable records and reopens the same isolated database',t => {
  const {repository,filename} = fixture(t);
  const inserted = task(repository);
  assert.equal(inserted.version,1);
  repository.close();
  const reopened = new SqliteRepository({filename});
  assert.deepEqual(reopened.get('tasks',scope,'task-a'),inserted);
  reopened.close();
});

test('queries require workspace and project and cannot read another scope',t => {
  const {repository} = fixture(t); task(repository);
  assert.equal(repository.get('tasks',other,'task-a'),null);
  assert.deepEqual(repository.list('tasks',other),[]);
  assert.deepEqual(repository.list('tasks',{...scope,workspace_id:'workspace-b'}),[]);
  assert.throws(() => repository.list('tasks',{workspace_id:scope.workspace_id}),{code:'SCOPE_REQUIRED'});
  assert.throws(() => repository.get('unknown',scope,'task-a'),{code:'COLLECTION_UNKNOWN'});
});

test('record cannot smuggle identity into another scope or change its opaque ID',t => {
  const {repository} = fixture(t);
  assert.throws(() => task(repository,'task-a',scope,{project_id:other.project_id}),{code:'RECORD_SCOPE_MISMATCH'});
  assert.throws(() => task(repository,'task-a',scope,{task_id:'different'}),{code:'IMMUTABLE_IDENTITY'});
  task(repository);
  assert.throws(() => repository.transaction(tx => tx.replace('tasks',other,'task-a',{status:'READY'},1)),{code:'RECORD_NOT_FOUND'});
});

test('same request identity has one record and duplicate insertion cannot mutate it',t => {
  const {repository} = fixture(t); task(repository);
  assert.throws(() => task(repository),{code:'DUPLICATE_RECORD'});
  assert.equal(repository.list('tasks',scope).length,1);
  task(repository,'task-a',other);
  assert.equal(repository.list('tasks',other).length,1);
});

test('idempotency uniqueness includes operation and both project identities',t => {
  const {repository} = fixture(t);
  const record = {operation:'create_task',idempotency_key:'same-key',request_hash:'a'.repeat(64)};
  repository.transaction(tx => tx.insert('idempotency',scope,'op-a',record));
  assert.throws(() => repository.transaction(tx => tx.insert('idempotency',scope,'op-b',record)),{code:'DUPLICATE_RECORD'});
  repository.transaction(tx => tx.insert('idempotency',other,'op-b',record));
  assert.equal(repository.list('idempotency',scope).length,1);
});

test('replace requires optimistic version and returns exact committed version',t => {
  const {repository} = fixture(t); const created = task(repository);
  const next = repository.transaction(tx => tx.replace('tasks',scope,'task-a',{...created,status:'READY'},1));
  assert.equal(next.version,2);
  assert.equal(next.status,'READY');
  assert.throws(() => repository.transaction(tx => tx.replace('tasks',scope,'task-a',next,1)),{code:'VERSION_CONFLICT'});
  assert.throws(() => repository.transaction(tx => tx.replace('tasks',scope,'task-a',next)),{code:'VERSION_REQUIRED'});
});

test('references enforce same workspace and project for runs and checkpoints',t => {
  const {repository} = fixture(t); task(repository);
  assert.throws(() => repository.transaction(tx => tx.insert('runs',other,'run-a',{run_id:'run-a',task_id:'task-a',status:'RUNNING'})),{code:'REFERENCE_SCOPE_MISMATCH'});
  repository.transaction(tx => tx.insert('runs',scope,'run-a',{run_id:'run-a',task_id:'task-a',status:'RUNNING'}));
  assert.throws(() => repository.transaction(tx => tx.insert('checkpoints',other,'checkpoint-a',{task_id:'task-a',run_id:'run-a'})),{code:'RUN_TASK_SCOPE_MISMATCH'});
  repository.transaction(tx => tx.insert('checkpoints',scope,'checkpoint-a',{task_id:'task-a',run_id:'run-a'}));
});

test('checkpoint run must belong to its task even within the same project',t => {
  const {repository} = fixture(t); task(repository); task(repository,'task-b');
  repository.transaction(tx => tx.insert('runs',scope,'run-a',{task_id:'task-a',status:'RUNNING'}));
  assert.throws(() => repository.transaction(tx => tx.insert('checkpoints',scope,'checkpoint-a',{task_id:'task-b',run_id:'run-a'})),{code:'RUN_TASK_SCOPE_MISMATCH'});
});

test('failed mandatory audit rolls back task and idempotency together',t => {
  const {repository} = fixture(t);
  repository.transaction(tx => tx.insert('audit',scope,'event-a',{event_type:'FIXTURE'}));
  assert.throws(() => repository.transaction(tx => {
    tx.insert('tasks',scope,'task-a',{status:'CREATED'});
    tx.insert('idempotency',scope,'idem-a',{operation:'task.create',idempotency_key:'key-a'});
    tx.insert('audit',scope,'event-a',{event_type:'TASK_CREATED'});
  }),{code:'DUPLICATE_RECORD'});
  assert.equal(repository.get('tasks',scope,'task-a'),null);
  assert.equal(repository.get('idempotency',scope,'idem-a'),null);
  assert.equal(repository.list('audit',scope).length,1);
});

test('swallowing a transaction operation error still prevents partial commit',t => {
  const {repository} = fixture(t);
  assert.throws(() => repository.transaction(tx => {
    tx.insert('tasks',scope,'task-a',{status:'CREATED'});
    try { tx.insert('audit',other,'audit-a',{project_id:scope.project_id}); } catch {}
  }),{code:'RECORD_SCOPE_MISMATCH'});
  assert.equal(repository.get('tasks',scope,'task-a'),null);
});

test('application exception aborts the transaction without preserving partial state',t => {
  const {repository} = fixture(t);
  assert.throws(() => repository.transaction(tx => { tx.insert('tasks',scope,'task-a',{}); throw new Error('synthetic failure'); }));
  assert.deepEqual(repository.list('tasks',scope),[]);
});

test('audit, policy, evidence, claims and skills are immutable',t => {
  const {repository} = fixture(t);
  for (const collection of ['audit','policies','evidence','claims','skills']) {
    repository.transaction(tx => tx.insert(collection,scope,'record-a',{content_hash:'a'.repeat(64)}));
    assert.throws(() => repository.transaction(tx => tx.replace(collection,scope,'record-a',{content_hash:'b'.repeat(64)},1)),{code:'IMMUTABLE_RECORD'});
  }
});

test('terminal task cannot be silently rewritten',t => {
  const {repository} = fixture(t); task(repository,'task-a',scope,{status:'SUCCEEDED'});
  assert.throws(() => repository.transaction(tx => tx.replace('tasks',scope,'task-a',{task_id:'task-a',status:'RUNNING'},1)),{code:'TERMINAL_RECORD'});
});

test('certificate authority is immutable and revocation is one-way',t => {
  const {repository} = fixture(t);
  const certificate = repository.transaction(tx => tx.insert('certificates',scope,'certificate-a',{
    certificate_id:'certificate-a',subject_agent:'agent-a',capabilities:['database.query'],permission_ceiling:'P1',revoked_at:null
  }));
  assert.throws(() => repository.transaction(tx => tx.replace('certificates',scope,'certificate-a',{
    ...certificate,permission_ceiling:'P4',revoked_at:'2026-09-22T00:00:00.000Z',revoked_by:'owner-a',revocation_reason:'test'
  },1)),{code:'CERTIFICATE_AUTHORITY_IMMUTABLE'});
  const revoked = repository.transaction(tx => tx.replace('certificates',scope,'certificate-a',{
    ...certificate,revoked_at:'2026-09-22T00:00:00.000Z',revoked_by:'owner-a',revocation_reason:'test'
  },1));
  assert.throws(() => repository.transaction(tx => tx.replace('certificates',scope,'certificate-a',{...revoked,revoked_at:null},2)),{code:'CERTIFICATE_REVOCATION_INVALID'});
});

test('DB rejects invalid states, P5/P6, R4/R5 and negative task budgets',t => {
  const {repository} = fixture(t);
  for (const invalid of [{status:'INVENTED'},{permission_ceiling:'P5'},{permission_ceiling:'P6'},{risk_class:'R4'},{risk_class:'R5'},{max_steps:-1},{max_cost:-0.1}]) {
    assert.throws(() => task(repository,'task-a',scope,invalid),{code:'RECORD_CONSTRAINT'});
  }
});

test('detached results cannot mutate stored records',t => {
  const {repository} = fixture(t); const row = task(repository,'task-a',scope,{nested:{value:1}});
  row.nested.value = 99;
  const fetched = repository.get('tasks',scope,'task-a'); fetched.nested.value = 42;
  assert.equal(repository.get('tasks',scope,'task-a').nested.value,1);
});

test('transaction closures, nested and async transactions cannot escape the boundary',t => {
  const {repository} = fixture(t); let retained;
  repository.transaction(tx => { retained = tx; });
  assert.throws(() => retained.insert('tasks',scope,'task-a',{}),{code:'TRANSACTION_CLOSED'});
  assert.throws(() => repository.transaction(async () => {}),{code:'SYNCHRONOUS_TRANSACTION_REQUIRED'});
  assert.throws(() => repository.transaction(() => repository.transaction(() => {})),{code:'NESTED_TRANSACTION_DENIED'});
  assert.throws(() => repository.transaction(tx => { tx.insert('tasks',scope,'task-a',{status:'CREATED'}); return Promise.resolve(); }),{code:'SYNCHRONOUS_TRANSACTION_REQUIRED'});
  assert.deepEqual(repository.list('tasks',scope),[]);
});

test('remote database filenames are denied without opening a connection',() => {
  for (const filename of ['https://production.invalid/db','postgres://production.invalid/db','file:remote.sqlite','\\\\host\\shared.sqlite','//host/share.sqlite']) {
    assert.throws(() => new SqliteRepository({filename}),{code:'LOCAL_DATABASE_REQUIRED'});
  }
});

test('migration supports fresh apply, empty rollback and reapply',() => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(up);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,1);
    db.exec(down);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,0);
    assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name = 'platform_records'").get().n,0);
    db.exec(up);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  } finally { db.close(); }
});

test('rollback refuses a populated database and preserves historical records',() => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(up); rawInsert(db,'audit',scope,'event-a',{event_type:'AUDIT'});
    assert.throws(() => db.exec(down),/CHECK constraint/);
    db.exec('ROLLBACK');
    assert.equal(db.prepare('SELECT count(*) n FROM platform_records').get().n,1);
  } finally { db.close(); }
});

test('SQL constraints remain effective when the repository facade is bypassed',() => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys = ON'); db.exec(up);
    rawInsert(db,'audit',scope,'event-a',{event_type:'AUDIT'});
    assert.throws(() => db.exec("UPDATE platform_records SET version=2,payload=json_set(payload,'$.version',2) WHERE collection='audit'"),/IMMUTABLE_RECORD/);
    assert.throws(() => db.exec('DELETE FROM platform_records'),/HISTORICAL_DELETE_DENIED/);
    assert.throws(() => rawInsert(db,'tasks',scope,'task-a',{workspace_id:undefined}),/CHECK constraint/);
    assert.throws(() => rawInsert(db,'runs',other,'run-a',{task_id:'task-a',status:'RUNNING'}),/FOREIGN KEY/);
  } finally { db.close(); }
});

test('unknown migration versions and unknown existing schemas fail closed',t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'phase0-schema-'));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  for (const [name,sql,code] of [['future','PRAGMA user_version = 2','SCHEMA_VERSION_UNSUPPORTED'],['unknown','CREATE TABLE unexpected (id TEXT)','SCHEMA_UNKNOWN']]) {
    const filename = path.join(directory,name+'.sqlite'); const db = new DatabaseSync(filename); db.exec(sql); db.close();
    assert.throws(() => new SqliteRepository({filename}),{code});
  }
});

test('migration identity drift fails closed before opening the repository',t => {
  const {repository,filename} = fixture(t); repository.close();
  const db = new DatabaseSync(filename); db.prepare('UPDATE platform_schema SET migration_hash=?').run('0'.repeat(64)); db.close();
  assert.throws(() => new SqliteRepository({filename}),{code:'SCHEMA_INTEGRITY_FAILURE'});
});

test('two connections cannot overwrite a newer record version',t => {
  const {repository,filename} = fixture(t); const original = task(repository);
  const second = new SqliteRepository({filename});
  try {
    repository.transaction(tx => tx.replace('tasks',scope,'task-a',{...original,status:'READY'},1));
    assert.throws(() => second.transaction(tx => tx.replace('tasks',scope,'task-a',{...original,status:'FAILED'},1)),{code:'VERSION_CONFLICT'});
    assert.equal(second.get('tasks',scope,'task-a').status,'READY');
  } finally { second.close(); }
});

test('audit sequence and approval nonce are unique within each project',t => {
  const {repository} = fixture(t);
  for (const [collection,record] of [['audit',{sequence:1}],['approvals',{nonce:'nonce-a'}]]) {
    repository.transaction(tx => tx.insert(collection,scope,'record-a',record));
    assert.throws(() => repository.transaction(tx => tx.insert(collection,scope,'record-b',record)),{code:'DUPLICATE_RECORD'});
    repository.transaction(tx => tx.insert(collection,other,'record-a',record));
  }
});

test('approval binding cannot change while one-time consumption remains supported',t => {
  const {repository} = fixture(t);
  const approval = repository.transaction(tx => tx.insert('approvals',scope,'approval-a',{
    nonce:'nonce-a',change_hash:'a'.repeat(64),status:'APPROVED',consumed_at:null
  }));
  assert.throws(() => repository.transaction(tx => tx.replace('approvals',scope,'approval-a',{...approval,change_hash:'b'.repeat(64)},1)),{code:'APPROVAL_BINDING_IMMUTABLE'});
  const consumed = repository.transaction(tx => tx.replace('approvals',scope,'approval-a',{...approval,status:'CONSUMED',consumed_at:'2026-09-22T00:00:00.000Z'},1));
  assert.throws(() => repository.transaction(tx => tx.replace('approvals',scope,'approval-a',{...consumed,status:'APPROVED',consumed_at:null},2)),{code:'APPROVAL_BINDING_IMMUTABLE'});
});

test('required task and run states and nested budget counters fail closed',t => {
  const {repository} = fixture(t);
  assert.throws(() => repository.transaction(tx => tx.insert('tasks',scope,'task-a',{})),{code:'RECORD_CONSTRAINT'});
  task(repository);
  assert.throws(() => repository.transaction(tx => tx.insert('runs',scope,'run-a',{task_id:'task-a'})),{code:'RECORD_CONSTRAINT'});
  for (const used of [{steps:-1},{steps:0.5},{cost:'1'},{retries:null}]) {
    assert.throws(() => task(repository,'invalid',scope,{used}),{code:'BUDGET_CONSTRAINT'});
  }
});

test('successful SQL insert with mismatching exact readback is rolled back',t => {
  const {repository} = fixture(t);
  const realGet = repository.get.bind(repository);
  repository.get = (...args) => { const result = realGet(...args); return result ? {...result,status:'FAILED'} : result; };
  assert.throws(() => task(repository),{code:'READBACK_MISMATCH'});
  assert.equal(realGet('tasks',scope,'task-a'),null);
  repository.get = realGet;
});

test('successful SQL replacement with failed readback is rolled back',t => {
  const {repository} = fixture(t); const before = task(repository);
  const realGet = repository.get.bind(repository); let reads = 0;
  repository.get = (...args) => { const row = realGet(...args); return ++reads > 1 ? null : row; };
  assert.throws(() => repository.transaction(tx => tx.replace('tasks',scope,'task-a',{...before,status:'READY'},1)),{code:'READBACK_MISMATCH'});
  assert.deepEqual(realGet('tasks',scope,'task-a'),before);
  repository.get = realGet;
});
