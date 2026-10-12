'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/staging/kk-make-owner-notification-v1.sql'),'utf8');

test('staged owner outbox is standalone and contains no booking/price business writes',()=>{
  assert.match(sql,/create table if not exists public\.kk_make_owner_notification_outbox/);
  assert.match(sql,/notification_id text primary key/);
  assert.match(sql,/request_id text not null unique/);
  assert.match(sql,/check \(event_type in \('OWNER_ALERT'\)\)/);
  assert.doesNotMatch(sql,/OWNER_APPROVAL_PREVIEW|BOOKING_CONFIRM|X_POST/);
  assert.doesNotMatch(sql,/\b(?:insert into|update|delete from)\s+(?:public\.)?(?:bookings|rental|events|prices|inventory)/i);
});
test('outbox data and claim/ACK functions are deny-by-default for public clients',()=>{
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.kk_make_owner_notification_outbox from public, anon, authenticated/);
  assert.match(sql,/grant select, insert, update on public\.kk_make_owner_notification_outbox to service_role/);
  assert.match(sql,/security invoker set search_path = ''/);
  assert.match(sql,/revoke all on function public\.kk_make_owner_notification_claim/);
  assert.match(sql,/revoke all on function public\.kk_make_owner_notification_ack/);
});
test('durable dispatch requires queued exact row and unexpired lease; ACK is one-shot and unexpired',()=>{
  assert.match(sql,/expires_at <= created_at \+ interval '2 minutes'/);
  assert.match(sql,/n\.status='QUEUED'/);
  assert.match(sql,/n\.receipt_id=p_receipt_id/);
  assert.match(sql,/n\.status='RESERVED'/);
  const expires=(sql.match(/n\.expires_at>pg_catalog\.now\(\)/g)||[]).length;
  assert.equal(expires,2,'both claim and ACK must enforce live lease');
  assert.match(sql,/p_provider_message_id !~ '\^\[0-9\]\{1,20\}\$'/);
});
