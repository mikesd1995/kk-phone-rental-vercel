// Disposable PostgreSQL only. Never reads environment credentials or contacts a provider.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const {PGlite} = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const results = [];
const provider = 'synthetic-consent-provider';
const user = 'U' + 'a'.repeat(32);
const version = 'KK-TERMS-2026-11-06';
const hash = 'a'.repeat(64);
const evidence = 'web:' + 'a'.repeat(43);

async function test(name, run) {
  try { await run(); results.push({name, passed:true}); }
  catch (err) { results.push({name, passed:false, message:err.message, code:err.code || null}); }
}
async function as(role, run) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec('set role ' + role);
  try { return await run(); } finally { await db.exec('reset role'); }
}
async function create(tokenHash, providerId = provider, userId = user) {
  return as('service_role', () => db.query(
    "select public.kk_customer_session_create($1,$2,$3,now()+interval '1 hour') as created",
    [tokenHash, providerId, userId]
  ));
}
async function accept(tokenHash = hash, ref = evidence, terms = version) {
  return as('service_role', () => db.query(
    'select * from public.kk_customer_terms_accept($1,$2,$3)', [tokenHash, terms, ref]
  ));
}
async function lookup(tokenHash = hash, terms = version) {
  return as('service_role', () => db.query(
    'select * from public.kk_customer_terms_lookup($1,$2)', [tokenHash, terms]
  ));
}

try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  const migration = await fs.readFile(new URL('../supabase/kk_customer_auth_v1.sql', import.meta.url), 'utf8');
  await test('migration installs and reapplies in disposable PostgreSQL', async () => {
    await db.exec(migration);
    await db.exec(migration);
  });
  await test('service-only session creation and lookup return verified identity', async () => {
    const created = await create(hash);
    assert.equal(created.rows[0].created, true);
    const session = await as('service_role', () => db.query(
      'select * from public.kk_customer_session_lookup($1)', [hash]
    ));
    assert.deepEqual(session.rows, [{provider_id:provider, line_user_id:user}]);
    await assert.rejects(() => create('raw-cookie-token'), /CUSTOMER_SESSION_INVALID/);
  });
  await test('first explicit acceptance persists; replay keeps one original receipt', async () => {
    assert.deepEqual((await lookup()).rows, []);
    const first = (await accept()).rows;
    assert.equal(first.length, 1);
    assert.equal(first[0].provider_id, provider);
    assert.equal(first[0].line_user_id, user);
    assert.equal(first[0].terms_version, version);
    assert.equal(first[0].evidence_source, 'AUTHENTICATED_WEB_ACTION');
    assert.equal(first[0].evidence_verified, true);
    assert.equal(first[0].evidence_reference, evidence);
    assert.ok(Number.isFinite(Date.parse(first[0].accepted_at)));
    assert.deepEqual((await accept(hash, 'web:' + 'b'.repeat(43))).rows, first);
    assert.deepEqual((await lookup()).rows, first);
    assert.equal((await db.query('select count(*)::int as n from public.kk_customer_terms_evidence')).rows[0].n, 1);
  });
  await test('new session for the same identity reuses durable evidence across devices', async () => {
    const otherHash = 'b'.repeat(64);
    await create(otherHash);
    const receipt = (await lookup(otherHash)).rows;
    assert.equal(receipt.length, 1);
    assert.equal(receipt[0].evidence_reference, evidence);
  });
  await test('provider, user and Terms version boundaries isolate receipts', async () => {
    await create('c'.repeat(64), 'other-provider');
    await create('d'.repeat(64), provider, 'U' + 'b'.repeat(32));
    for (const tokenHash of ['c'.repeat(64), 'd'.repeat(64)]) {
      assert.deepEqual((await lookup(tokenHash)).rows, []);
    }
    assert.deepEqual((await lookup(hash, 'KK-TERMS-2026-11-07')).rows, []);
    const signedLookup = await as('service_role', () => db.query(
      'select * from public.kk_customer_terms_lookup_for_line_webhook($1,$2,$3)',
      [provider, user, version]
    ));
    assert.equal(signedLookup.rows.length, 1);
    for (const args of [['other-provider', user, version], [provider, 'U'+'b'.repeat(32), version], [provider, user, 'KK-TERMS-2026-11-07']]) {
      assert.deepEqual((await as('service_role', () => db.query(
        'select * from public.kk_customer_terms_lookup_for_line_webhook($1,$2,$3)', args
      ))).rows, []);
    }
  });
  await test('invalid affirmation evidence and Terms version cannot persist', async () => {
    await assert.rejects(() => accept(hash, 'client-checkbox'), /CUSTOMER_TERMS_REQUEST_INVALID/);
    await assert.rejects(() => accept(hash, evidence, 'unversioned'), /CUSTOMER_TERMS_REQUEST_INVALID/);
  });
  await test('revoked and expired sessions cannot read or create acceptance', async () => {
    const revokedHash = 'e'.repeat(64), expiredHash = 'f'.repeat(64);
    await create(revokedHash);
    await create(expiredHash);
    await as('service_role', () => db.query('select public.kk_customer_session_revoke($1)', [revokedHash]));
    await db.query("update public.kk_customer_line_sessions set expires_at=now()-interval '1 second' where token_hash=$1", [expiredHash]);
    for (const tokenHash of [revokedHash, expiredHash]) {
      assert.deepEqual((await lookup(tokenHash)).rows, []);
      assert.deepEqual((await as('service_role', () => db.query(
        'select * from public.kk_customer_session_lookup($1)', [tokenHash]
      ))).rows, []);
      await assert.rejects(() => accept(tokenHash, 'web:'+'z'.repeat(43)), /CUSTOMER_SESSION_EXPIRED/);
    }
  });
  for (const role of ['anon', 'authenticated']) {
    await test(role + ' cannot read/write evidence or call customer RPCs', async () => {
      await as(role, async () => {
        for (const table of ['kk_customer_line_sessions', 'kk_customer_terms_evidence']) {
          await assert.rejects(() => db.query('select * from public.' + table), {code:'42501'});
          await assert.rejects(() => db.query('delete from public.' + table), {code:'42501'});
        }
        await assert.rejects(() => db.query('select public.kk_customer_session_create($1,$2,$3,now()+interval \'1 hour\')', [hash, provider, user]), {code:'42501'});
        await assert.rejects(() => db.query('select * from public.kk_customer_session_lookup($1)', [hash]), {code:'42501'});
        await assert.rejects(() => db.query('select public.kk_customer_session_revoke($1)', [hash]), {code:'42501'});
        await assert.rejects(() => db.query('select * from public.kk_customer_terms_lookup($1,$2)', [hash, version]), {code:'42501'});
        await assert.rejects(() => db.query('select * from public.kk_customer_terms_accept($1,$2,$3)', [hash, version, evidence]), {code:'42501'});
        await assert.rejects(() => db.query('select * from public.kk_customer_terms_lookup_for_line_webhook($1,$2,$3)', [provider, user, version]), {code:'42501'});
      });
    });
  }
  await test('both tables retain RLS and RPCs remain security invoker', async () => {
    const tables = await db.query("select relname,relrowsecurity from pg_class where relname in ('kk_customer_line_sessions','kk_customer_terms_evidence') order by relname");
    assert.equal(tables.rows.length, 2);
    assert.ok(tables.rows.every(row => row.relrowsecurity === true));
    const functions = await db.query("select prosecdef from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname like 'kk_customer_%'");
    assert.equal(functions.rows.length, 6);
    assert.ok(functions.rows.every(row => row.prosecdef === false));
  });
} finally {
  await db.close();
}
const failed = results.filter(result => !result.passed);
console.log(JSON.stringify({scope:'DISPOSABLE_POSTGRESQL_SYNTHETIC_ONLY', passed:results.length-failed.length, failed:failed.length, results}, null, 2));
if (failed.length) process.exitCode = 1;
