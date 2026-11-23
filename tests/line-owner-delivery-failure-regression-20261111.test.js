'use strict';
// Regression contract: never send a duplicate LINE notification on canonical
// replay, and never notify an owner that a customer push succeeded when it failed.
// These tests intentionally use only local mock fetch; no provider or Sheets writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const Approval = require('../server/line-booking-owner-approval');

const env = () => ({
  KK_LINE_BOOKING_AUTOMATION_ENABLED: 'true',
  KK_ADMIN_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec',
  KK_ADMIN_API_KEY: 'test-key',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  KK_OWNER_LINE_USER_ID: 'UOWNER'
});
const ok = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body)
});
const event = (bookingId, e) => ({
  type: 'postback',
  replyToken: 'synthetic-owner-reply',
  source: { type: 'user', userId: 'UOWNER' },
  postback: { data: Approval.decisionData('approve', bookingId, e) }
});

test('canonical idempotent replay sends zero LINE messages even with a reply token', async () => {
  const e = env();
  const calls = [];
  const result = await Approval.processOwnerPostback(event('BK-REPLAY', e), e, async (url, options) => {
    calls.push({ url, options });
    assert.match(url, /^https:\/\/script\.google\.com\//);
    return ok({
      ok: true,
      booking_id: 'BK-REPLAY',
      booking_status: 'confirmed',
      decision: 'approve',
      idempotent_replay: true,
      customer_contact: 'UCUSTOMER'
    });
  });
  assert.equal(result.status, 'ALREADY_APPLIED');
  assert.equal(result.customer_notifications, 0);
  assert.equal(result.owner_notifications, 0);
  assert.equal(result.requires_manual_delivery_review, true);
  assert.equal(calls.length, 1);
});

test('customer provider rejection cannot produce owner success reply', async () => {
  const e = env();
  const calls = [];
  await assert.rejects(
    () => Approval.processOwnerPostback(event('BK-PUSH-FAIL', e), e, async (url, options) => {
      calls.push(url);
      if (url.startsWith('https://script.google.com/')) {
        return ok({
          ok: true,
          booking_id: 'BK-PUSH-FAIL',
          booking_status: 'confirmed',
          decision: 'approve',
          idempotent_replay: false,
          customer_contact: 'UCUSTOMER'
        });
      }
      assert.match(url, /\/push$/);
      assert.equal(JSON.parse(options.body).to, 'UCUSTOMER');
      return ok({ message: 'untrusted provider detail' }, 503);
    }),
    err => err && err.code === 'LINE_SEND_FAILED' &&
      err.status === 503 && !String(err.message).includes('untrusted provider detail')
  );
  assert.equal(calls.length, 3); // canonical + two keyed pushes
  assert.equal(calls.filter(url => /\/push$/.test(url)).length, 2);
  assert.equal(calls.some(url => /\/reply$/.test(url)), false);
});

test('canonical decision response must include boolean replay evidence before any send', async () => {
  const e = env();
  let sends = 0;
  await assert.rejects(
    () => Approval.processOwnerPostback(event('BK-REPLAY-UNKNOWN', e), e, async url => {
      if (url.startsWith('https://script.google.com/')) {
        return ok({
          ok: true,
          booking_id: 'BK-REPLAY-UNKNOWN',
          booking_status: 'confirmed',
          decision: 'approve',
          idempotent_replay: 'false',
          customer_contact: 'UCUSTOMER'
        });
      }
      sends++;
      return ok({ ok: true });
    }),
    err => err && err.code === 'LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED'
  );
  assert.equal(sends, 0);
});

test('ambiguous transport failure after canonical commit never sends owner success', async () => {
  const e = env();
  const calls = [];
  await assert.rejects(
    () => Approval.processOwnerPostback(event('BK-TRANSPORT-UNKNOWN', e), e, async url => {
      calls.push(url);
      if (url.startsWith('https://script.google.com/')) {
        return ok({
          ok: true,
          booking_id: 'BK-TRANSPORT-UNKNOWN',
          booking_status: 'confirmed',
          decision: 'approve',
          idempotent_replay: false,
          customer_contact: 'UCUSTOMER'
        });
      }
      throw new Error('synthetic network error containing customer data');
    }),
    err => err && err.code === 'LINE_SEND_TRANSPORT_FAILED' &&
      !String(err.message).includes('customer data')
  );
  assert.equal(calls.filter(url => /\/push$/.test(url)).length, 2);
  assert.equal(calls.some(url => /\/reply$/.test(url)), false);
});

test('mismatched canonical booking identity blocks every LINE send', async () => {
  const e = env();
  let lineSends = 0;
  await assert.rejects(
    () => Approval.processOwnerPostback(event('BK-EXPECTED', e), e, async url => {
      if (url.startsWith('https://script.google.com/')) {
        return ok({
          ok: true,
          booking_id: 'BK-OTHER',
          booking_status: 'confirmed',
          decision: 'approve',
          idempotent_replay: false,
          customer_contact: 'UCUSTOMER'
        });
      }
      lineSends++;
      return ok({ ok: true });
    }),
    err => err && err.code === 'LINE_OWNER_DECISION_BOOKING_ID_MISMATCH'
  );
  assert.equal(lineSends, 0);
});

test('ambiguous timeout then LINE 409 accepted receipt is deduplicated and owner reply follows', async () => {
  const e=env(), pushes=[], replies=[];
  const result=await Approval.processOwnerPostback(event('BK-RETRY-409',e),e,async (url,options) => {
    if(url.startsWith('https://script.google.com/')) return ok({
      ok:true,booking_id:'BK-RETRY-409',booking_status:'confirmed',
      decision:'approve',idempotent_replay:false,customer_contact:'UCUSTOMER'
    });
    if(/\/push$/.test(url)){
      pushes.push(options);
      if(pushes.length===1) throw new Error('untrusted socket timeout with personal data');
      return {...ok({message:'already accepted'},409),headers:{
        get(name){return name==='x-line-accepted-request-id'?'accepted-request-123':null;}
      }};
    }
    replies.push(options);
    assert.match(url,/\/reply$/);
    return ok({});
  });
  assert.equal(result.status,'CONFIRMED');
  assert.equal(pushes.length,2);
  assert.equal(replies.length,1);
  const keys=pushes.map(p=>p.headers['X-Line-Retry-Key']);
  assert.match(keys[0],/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(keys[0],keys[1]);
  assert.equal(pushes[0].body,pushes[1].body);
  assert.equal(replies[0].headers['X-Line-Retry-Key'],undefined);
});

test('retryable LINE 503 then 200 completes one owner reply and preserves payload', async () => {
  const e=env(), pushes=[];
  let replies=0;
  const result=await Approval.processOwnerPostback(event('BK-RETRY-200',e),e,async (url,options)=>{
    if(url.startsWith('https://script.google.com/')) return ok({
      ok:true,booking_id:'BK-RETRY-200',booking_status:'confirmed',
      decision:'approve',idempotent_replay:false,customer_contact:'UCUSTOMER'
    });
    if(/\/push$/.test(url)){
      pushes.push(options);
      return pushes.length===1?ok({message:'untrusted'},503):ok({});
    }
    replies++;
    return ok({});
  });
  assert.equal(result.status,'CONFIRMED');
  assert.equal(pushes.length,2);
  assert.equal(pushes[0].headers['X-Line-Retry-Key'],pushes[1].headers['X-Line-Retry-Key']);
  assert.equal(pushes[0].body,pushes[1].body);
  assert.equal(replies,1);
});

test('LINE 400 is never retried and owner success is never sent',async ()=>{
  const e=env();
  let pushes=0,replies=0;
  await assert.rejects(
    ()=>Approval.processOwnerPostback(event('BK-400',e),e,async url=>{
      if(url.startsWith('https://script.google.com/'))return ok({
        ok:true,booking_id:'BK-400',booking_status:'confirmed',
        decision:'approve',idempotent_replay:false,customer_contact:'UCUSTOMER'
      });
      if(/\/push$/.test(url)){pushes++;return ok({message:'private upstream'},400);}
      replies++;
      return ok({});
    }),
    err=>err && err.code==='LINE_SEND_FAILED' && err.status===400 &&
      !String(err.message).includes('private upstream')
  );
  assert.equal(pushes,1);
  assert.equal(replies,0);
});

test('LINE 409 without accepted-request-id evidence fails closed',async ()=>{
  const e=env();
  let pushes=0,replies=0;
  await assert.rejects(
    ()=>Approval.processOwnerPostback(event('BK-409-NO-RECEIPT',e),e,async url=>{
      if(url.startsWith('https://script.google.com/'))return ok({
        ok:true,booking_id:'BK-409-NO-RECEIPT',booking_status:'confirmed',
        decision:'approve',idempotent_replay:false,customer_contact:'UCUSTOMER'
      });
      if(/\/push$/.test(url)){pushes++;return ok({message:'arbitrary provider 409'},409);}
      replies++;
      return ok({});
    }),
    err=>err && err.code==='LINE_SEND_FAILED' && err.status===409
  );
  assert.equal(pushes,1);
  assert.equal(replies,0);
});
