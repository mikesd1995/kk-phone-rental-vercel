'use strict';
// This file is a CLI bootstrap, never an HTTP server or a production adapter.
// Windows can supply OS defaults even with an explicit spawn env. Scrub by name
// before imports; never inspect those values or accept application configuration.
const startupEnvironmentKeys = Object.keys(process.env).sort();
for (const key of startupEnvironmentKeys) if (!['LANG','TZ','SystemRoot'].includes(key)) delete process.env[key];
const assert = require('node:assert/strict');
const {createDummyTransport, installNetworkGuards} = require('./line-booking-dummy-transport.cjs');
const guards = installNetworkGuards(); // Must precede every application/test import.
const crypto = require('node:crypto');
const [mode, id] = process.argv.slice(2);
const REGRESSIONS = Object.freeze({
  'line-webhook': '../line-webhook.test.js',
  'line-webhook-raw-body': '../line-webhook-raw-body.test.js',
  'line-booking-inbox-tee': '../line-booking-inbox-tee.test.js',
  'line-booking-inbox-safety-integration': '../line-booking-inbox-safety-integration.test.js',
  'kk-line-inbox-tee': '../kk-line-inbox-tee.test.js',
  'kk-inbox-private-media': '../kk-inbox-private-media.test.js',
  'line-booking-initial-outbox-integration': '../line-booking-initial-outbox-integration.test.js',
  'line-booking-owner-durable-outbox': '../line-booking-owner-durable-outbox.test.js',
  'line-booking-owner-approval-replay-failclosed': '../line-booking-owner-approval-replay-failclosed.test.js'
});
const SCENARIOS = ['guard-proof','transport-proof','ingress','disabled-inbox','mock-inbox',
  'hidden','ambiguous','unavailable','missing-consent','mismatched-consent','swallowed-denial',
  'recovery','uncertain','claimed','owner-confirm','owner-reject'];
const result = {schemaVersion: 1, scenarioId: id, evidenceClass: 'LOCAL_MOCK', guardsInstalled: true,
  counters: {}, denialCount: 0, pendingCount: 0, blockedAttemptCount: 0, safeStateHashes: {}, assertionFailures: []};
result.environmentKeys = Object.keys(process.env).sort();
result.scrubbedEnvironmentKeys = startupEnvironmentKeys.filter(key => !result.environmentKeys.includes(key));
const transports = [];
let proof = false;
function failure(code) {if (!result.assertionFailures.includes(code)) result.assertionFailures.push(code); process.exitCode = 1;}
process.on('unhandledRejection', () => failure('UNHANDLED_REJECTION'));
process.on('uncaughtException', () => failure('UNCAUGHT_EXCEPTION'));
process.once('exit', code => {
  for (const transport of transports) {
    result.denialCount += transport.denials.length; result.pendingCount += transport.pending;
    for (const [route, count] of Object.entries(transport.counters())) result.counters[route] = (result.counters[route] || 0) + count;
  }
  result.blockedAttemptCount = guards.blockedAttempts.length;
  if (!proof && result.denialCount) failure('FIXTURE_DENIAL');
  if (!proof && result.blockedAttemptCount) failure('UNEXPECTED_EGRESS');
  if (result.pendingCount) failure('FIXTURE_PENDING');
  if (code && !result.assertionFailures.length) failure('LEAF_TEST_FAILURE');
  process.stdout.write('S1_RESULT ' + JSON.stringify(result) + '\n');
});
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => new Response(JSON.stringify(value), {headers: {'content-type':'application/json','x-line-request-id':'synthetic-request'}});
const E = 'https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK&showPast=1';
const P = 'https://kk-phone-rental.vercel.app/api/kk-data?sheet=09_Web_Packages&range=A4%3AN';
const ASSET = 'https://kk-phone-rental.vercel.app/assets/event-posters/dummy.png';
const GAS = 'https://script.google.com/macros/s/SYNTHETIC/exec';
const AUTH = 'https://s1-auth-dummy.supabase.co/rest/v1/rpc/kk_customer_terms_lookup_for_line_webhook';
const INBOX = 'https://s1-inbox-dummy.supabase.co';
const OWNER = 'U'+'a'.repeat(32), CUSTOMER = 'U'+'c'.repeat(32);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const ENV = Object.freeze({LINE_CHANNEL_SECRET:'synthetic-s1-hmac', LINE_CHANNEL_ACCESS_TOKEN:'synthetic-s1-token',
  KK_LINE_BOOKING_AUTOMATION_ENABLED:'true', KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'true',
  KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'synthetic_initial_dispatch_secret_20261114',
  KK_ADMIN_SCRIPT_URL:GAS, KK_ADMIN_API_KEY:'distinct-admin-key', KK_OWNER_LINE_USER_ID:OWNER,
  KK_CUSTOMER_LOGIN_ENABLED:'true', KK_LINE_LOGIN_PROVIDER_VERIFIED:'true',
  KK_CUSTOMER_AUTH_MIGRATION_VERIFIED:'true', KK_LINE_LOGIN_PROVIDER_ID:'synthetic-s1-provider',
  KK_CUSTOMER_AUTH_SUPABASE_URL:'https://s1-auth-dummy.supabase.co',
  KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY:'synthetic-s1-auth-service-key-only'});
function body(options) {return JSON.parse(options.body);}
function authHeaders(options, key) {
  const headers = new Headers(options.headers);
  assert.equal(headers.get('authorization'), 'Bearer ' + key);
}
function route(id, url, method, max, validate, respond, headers) {
  return {id,url,method,max,min:0,validate,respond,headers};
}
function response() {return {statusCode:0,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(b){this.body=b;}};}
async function deliver(wrapper, events, overrides = {}) {
  result.rawWrapperCalls = (result.rawWrapperCalls || 0) + 1;
  const bytes = overrides.bytes || Buffer.from(JSON.stringify({events, fixtureTarget:'https://forbidden.invalid/'}));
  const signature = crypto.createHmac('sha256',ENV.LINE_CHANNEL_SECRET).update(bytes).digest('base64');
  const req = {method: overrides.method || 'POST', url:'/api/line-webhook?fixtureTarget=https://forbidden.invalid/',
    headers:{'x-line-signature':overrides.signature || signature,'x-fixture-target':'https://forbidden.invalid/'},
    async *[Symbol.asyncIterator]() {yield bytes.subarray(0,7); yield bytes.subarray(7);}};
  const res = response(); await wrapper(req,res); return res;
}
function booking() {return {type:'message',timestamp:1794700800000,webhookEventId:'SYNTHETIC_S1_BOOKING_1',replyToken:'synthetic-customer-reply',
  source:{type:'user',userId:CUSTOMER},message:{type:'text',id:'12345678901',text:
    'สนใจเช่า Phone\nงาน: Synthetic Event\nวันที่: 18/11/2026\nสถานที่: Synthetic Hall\nราคา: 1 บาท\nชื่อเล่น: Synthetic Customer\nเวลารับอุปกรณ์: 16:00'}};}
const image = () => ({type:'message',timestamp:1794700800000,webhookEventId:'SYNTHETIC_S1_IMAGE_1',source:{type:'user',userId:CUSTOMER},
  message:{type:'image',id:'12345678902'}});
async function guardProof() {
  proof = true;
  // Fail before constructing anything if the public UDP aliases lack guards.
  for (const name of ['dgram.Socket','dgram.Socket.send','dgram.Socket.bind','dgram.Socket.connect'])
    assert.ok(guards.installed.includes(name), 'UDP_GUARD_NOT_INSTALLED');
  assert.equal(typeof guards.isSensitiveFile, 'function', 'PURE_FILE_PREDICATE_REQUIRED');
  for (const file of ['.aws/credentials','.ssh/id_ed25519','.codex/auth.json','.cursor/auth.json',
    './.aws/credentials','C:/synthetic/.ssh/id_ed25519','C:\\synthetic\\.codex\\auth.json'])
    assert.equal(guards.isSensitiveFile(file), true, 'SENSITIVE_PATH_MISSED');
  for (const file of ['synthetic/source.js','synthetic/aws/fixture.js','synthetic/codex/source.js'])
    assert.equal(guards.isSensitiveFile(file), false, 'PUBLIC_PATH_OVERBLOCKED');
  result.sensitivePathPredicateChecks = 10;
  const probes = [
    () => global.fetch('https://forbidden.invalid/'),
    () => require('node:http').request('http://forbidden.invalid/'),
    () => require('node:http').get('http://forbidden.invalid/'),
    () => require('node:https').request('https://forbidden.invalid/'),
    () => require('node:https').get('https://forbidden.invalid/'),
    () => require('node:net').connect(1,'127.0.0.1'),
    () => require('node:net').createConnection(1,'127.0.0.1'),
    () => new (require('node:net').Socket)().connect(1,'127.0.0.1'),
    () => new (require('node:net').Server)().listen(0),
    () => require('node:http').createServer(),
    () => require('node:https').createServer(),
    () => require('node:tls').connect(1,'127.0.0.1'),
    () => new (require('node:tls').TLSSocket)(),
    () => require('node:http2').connect('https://forbidden.invalid/'),
    () => require('node:http2').createServer(),
    () => require('node:http2').createSecureServer(),
    () => require('node:dns').lookup('forbidden.invalid',()=>{}),
    () => require('node:dns').resolve('forbidden.invalid',()=>{}),
    () => require('node:dns').promises.lookup('forbidden.invalid'),
    () => require('node:dns').promises.resolve('forbidden.invalid'),
    () => new (require('node:dns').Resolver)().resolve('forbidden.invalid',()=>{}),
    () => new (require('node:dns').promises.Resolver)().resolve('forbidden.invalid'),
    () => require('node:dgram').createSocket('udp4'),
    () => new (require('node:dgram').Socket)('udp4'),
    // Borrow patched prototype entry points with an inert object, never a socket.
    ...['send','bind','connect'].map(key => () => require('node:dgram').Socket.prototype[key].call({})),
    ...['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'].map(key => () => require('node:child_process')[key]('SYNTHETIC_BLOCKED')),
    () => new (require('node:worker_threads').Worker)('SYNTHETIC_BLOCKED'),
    () => require('node:fs').readFileSync('.env'),
    () => require('node:fs').promises.readFile('.env.local')
  ];
  if (typeof global.WebSocket === 'function') probes.push(() => new WebSocket('wss://forbidden.invalid/'));
  for (const probe of probes) {
    const prior = guards.blockedAttempts.length;
    await assert.rejects(async () => probe(), err => err.code === 'S1_EGRESS_BLOCKED');
    assert.equal(guards.blockedAttempts.length, prior+1);
  }
  result.expectedProbeCount = probes.length;
}
async function transportProof() {
  proof = true;
  const transport = createDummyTransport({routes:[route('ONE','https://fixture.invalid/exact?x=1','POST',1,
    options => assert.deepEqual(body(options),{synthetic:true}), () => json({ok:true})),
    route('REDIRECT','https://fixture.invalid/redirect','GET',1,null, () => new Response(null,{status:302,headers:{location:'https://forbidden.invalid/'}}))]});
  transports.push(transport);
  const good = {method:'POST',body:'{"synthetic":true}'};
  for (const [url, options] of [
    ['https://fixture.invalid/exact?x=2',good], ['https://fixture.invalid/exact?x=1',{...good,method:'PUT'}],
    ['https://fixture.invalid/exact?x=1',{...good,body:'{"synthetic":false}'}],
    ['https://fixture.invalid/exact?x=1',{...good,redirect:'follow'}], ['https://fixture.invalid/redirect',{}]
  ]) await assert.rejects(() => transport.fetch(url,options));
  await transport.fetch('https://fixture.invalid/exact?x=1',good);
  await assert.rejects(() => transport.fetch('https://fixture.invalid/exact?x=1',good));
  assert.throws(() => transport.assertComplete()); result.expectedProbeCount=6;
  const afterValid = createDummyTransport({routes:[{
    ...route('AFTER_VALID','https://fixture.invalid/after-valid','POST',1,null,()=>json({ok:true}),{'user-agent':'synthetic-proof'}),min:1
  }]});
  transports.push(afterValid);
  await afterValid.fetch('https://fixture.invalid/after-valid',{method:'POST',headers:{'user-agent':'synthetic-proof'}});
  afterValid.assertComplete(); // Required legitimate call has already completed.
  for (const malformed of [null,{method:'POST',headers:[['malformed']]},
    {method:'POST',headers:{'user-agent':'synthetic-proof\ninvalid'}}]) {
    const prior=afterValid.denials.length;
    try {await afterValid.fetch('https://fixture.invalid/after-valid',malformed);} catch (_) { /* model handler catch */ }
    assert.equal(afterValid.denials.length,prior+1,'CAUGHT_MALFORMED_ATTEMPT_MUST_COUNT');
    assert.throws(()=>afterValid.assertComplete());
  }
  result.caughtMalformedAttempts=3; result.expectedProbeCount+=3;
}

async function rehearsal() {
  // Validate the complete clean environment before supplying literal dummy config.
  for (const key of Object.keys(process.env)) assert.ok(['LANG','TZ','SystemRoot'].includes(key), 'UNEXPECTED_CHILD_ENV');
  Object.assign(process.env, ENV);
  const inbox = ['mock-inbox','hidden','ambiguous','unavailable','missing-consent','mismatched-consent','swallowed-denial'].includes(id);
  if (inbox) Object.assign(process.env,{KK_INBOX_SUPABASE_URL:INBOX,KK_INBOX_SUPABASE_SERVICE_ROLE_KEY:'synthetic-s1-inbox-key'});
  result.inboxMode = inbox ? 'MOCK' : 'DISABLED';
  // Default fetch was already denied before any application imports.
  const wrapper = require('../../api/line-webhook');
  const poster = require('../../api/line-poster');
  const Webhook = require('../../server/line-booking-webhook');
  const Line = require('../../server/kk-line-webhook');
  const Terms = require('../../server/kk-booking-terms-evidence');
  const {harness,BID,SECRET} = require('./line-initial-outbox-harness');
  const h = harness();
  let eventCsv = 'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\n'+
    'EVT-SYNTHETIC,Synthetic Event,18/11/2026,Synthetic Hall,/assets/event-posters/dummy.png,show,เปิดจอง,1';
  if (id === 'hidden') eventCsv = eventCsv.replace(',show,',',hide,');
  if (id === 'ambiguous') eventCsv += '\nEVT-DUPLICATE,Synthetic Event,18/11/2026,Synthetic Hall,/assets/event-posters/dummy.png,show,เปิดจอง,1';
  const packageCsv = 'package_id,event_id,package_type,model_display,price,available_count,package_status\n'+
    'TPL-PHONE,EVT-SYNTHETIC,phone_only,Phone,790,'+(id==='unavailable'?'0':'1')+',available';
  const normalized = new Map([booking(),image()].map(e => {const m=Line.normalizeEvent(e); return [m.message_id,m];}));
  const inboxSeen = new Set(), inboxOrder = [], sent = [], contexts = [], originalPair = [];
  let duplicateCount = 0, lost = false, capturedHero = '';
  const actions = {lineInitialOutboxReadiness:h.ready,createLineBookingPending:h.create,
    claimLineBookingInitialDelivery:h.claim,settleLineBookingInitialDelivery:h.settle};
  const routes = [
    route('PUBLIC_EVENTS',E,'GET',10,null,() => new Response(eventCsv),{'user-agent':'KK-Line-Webhook/1.0'}),
    route('PUBLIC_PACKAGES',P,'GET',10,null,() => new Response(packageCsv),{'user-agent':'KK-Line-Webhook/1.0'}),
    route('POSTER_EVENTS',E,'GET',1,null,() => new Response(eventCsv),{'user-agent':'KK-Line-Poster/1.0'}),
    route('POSTER_BYTES',ASSET,'GET',1,null,() => new Response(PNG,{headers:{'content-type':'image/png','content-length':String(PNG.length)}}),{'user-agent':'KK-Line-Poster/1.0'}),
    route('AUTH_RECEIPT',AUTH,'POST',10,options => {
      authHeaders(options,ENV.KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY);
      assert.deepEqual(body(options),{p_provider_id:ENV.KK_LINE_LOGIN_PROVIDER_ID,p_line_user_id:CUSTOMER,p_terms_version:Terms.VERSION});
    },() => json(id==='missing-consent'?[]:[{provider_id:ENV.KK_LINE_LOGIN_PROVIDER_ID,
      line_user_id:id==='mismatched-consent'?OWNER:CUSTOMER,terms_version:Terms.VERSION,
      evidence_verified:true,evidence_source:'SIGNED_LINE_WEBHOOK',evidence_reference:'synthetic:s1:receipt:000001',accepted_at:'2026-11-07T00:00:00Z'}])),
    route('GAS_ACTION',GAS,'POST',40,options => {
      const p=body(options); assert.ok(Object.hasOwn(actions,p.action));
      assert.equal(p.apiKey,ENV.KK_ADMIN_API_KEY); assert.equal(p.source,'LINE_OWNER_APPROVAL');
      assert.equal(p.automation_version,Webhook._test.OwnerApproval.VERSION); assert.equal(p.initial_dispatch_key,SECRET);
      if (p.action==='createLineBookingPending') {
        assert.equal(p.event_id,'EVT-SYNTHETIC'); assert.equal(p.template_id,'TPL-PHONE');
        assert.equal(p.customer_contact,CUSTOMER); assert.match(p.request_id,/^line:[a-f0-9]{48}$/);
        const c=JSON.parse(p.initial_notification.context_json);
        assert.equal(c.price_display,'790 บาท'); assert.equal(c.terms_status,'VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED');
        assert.equal(c.poster_image_url,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-SYNTHETIC');
        contexts.push(p.initial_notification.context_json);
      } else if (p.action!=='lineInitialOutboxReadiness') {
        assert.equal(p.booking_id,BID); assert.match(p.request_id,/^line:[a-f0-9]{48}$/);
        assert.ok(['OWNER_APPROVAL_PUSH','CUSTOMER_PENDING_REPLY'].includes(p.kind));
        const row=h.ledger.rows.slice(1).find(r=>r[0]===p.outbox_id); assert.ok(row);
        assert.equal(p.context_hash,row[10]); assert.equal(p.request_id,row[8]);
      }
    },options => {
      const p=body(options);
      if (id==='claimed' && p.action==='settleLineBookingInitialDelivery' && p.kind==='OWNER_APPROVAL_PUSH')
        throw Error('SYNTHETIC_SETTLEMENT_NOT_COMMITTED');
      let data;
      try {data=actions[p.action](p);} catch (_) {return json({ok:false,error:'SYNTHETIC_VM_REJECTION'});}
      if (id==='recovery' && p.action==='settleLineBookingInitialDelivery' && p.kind==='OWNER_APPROVAL_PUSH' && !lost) {
        lost=true;
        // Recovery models a persisted receipt with a lost acknowledgement.
        return json({ok:false,error:'SYNTHETIC_LOST_SETTLEMENT_ACK'});
      }
      return json({ok:true,...data});
    }),
    route('LINE_PUSH','https://api.line.me/v2/bot/message/push','POST',1,options => {
      authHeaders(options,ENV.LINE_CHANNEL_ACCESS_TOKEN); const p=body(options);
      assert.equal(p.to,OWNER); assert.equal(p.messages.length,1); assert.equal(p.messages[0].type,'flex');
      const expected=Webhook._test.OwnerApproval.ownerApprovalMessage({...JSON.parse(h.ledger.rows[1][9]),booking_id:BID},process.env);
      assert.deepEqual(p.messages,[expected]);
      assert.equal(h.ledger.rows[1][3],'CLAIMED');
    },options => {sent.push('owner');
      if(id==='uncertain') throw Error('SYNTHETIC_PROVIDER_UNCERTAIN');
      return json({sentMessages:[{id:'synthetic-owner-receipt'}]});}),
    route('LINE_REPLY','https://api.line.me/v2/bot/message/reply','POST',1,options => {
      authHeaders(options,ENV.LINE_CHANNEL_ACCESS_TOKEN); const p=body(options);
      assert.equal(p.replyToken,'synthetic-customer-reply'); assert.equal(p.messages.length,1);
      assert.equal(p.messages[0].type,'flex'); assert.equal(h.ledger.rows[2][3],'CLAIMED');
      capturedHero = p.messages[0].contents.hero.url;
      const frozen=JSON.parse(h.ledger.rows[2][9]);
      assert.deepEqual(p.messages,[require('../../server/line-booking-flex').buildBookingFlex({event:frozen,package:frozen,customer:frozen,booking:{booking_id:BID}})]);
    },() => {sent.push('customer'); return json({sentMessages:[{id:'synthetic-customer-receipt'}]});})
  ];
  if (inbox) routes.push(
    route('INBOX_PROFILE','https://api.line.me/v2/bot/profile/'+CUSTOMER,'GET',id==='swallowed-denial'?1:10,
      options => authHeaders(options,ENV.LINE_CHANNEL_ACCESS_TOKEN), () => {inboxOrder.push('profile');return json({displayName:'Synthetic Customer'});}),
    route('INBOX_RPC',INBOX+'/rest/v1/rpc/kk_inbox_persist_inbound','POST',10, options => {
      authHeaders(options,'synthetic-s1-inbox-key'); const p=body(options); assert.deepEqual(Object.keys(p),['p_message']);
      const expected=normalized.get(p.p_message.message_id); assert.ok(expected);
      assert.deepEqual(p.p_message,id==='swallowed-denial'?expected:{...expected,display_name:'Synthetic Customer'});
    },options => {const m=body(options).p_message; inboxOrder.push('persist:'+m.message_type);
      const duplicate=inboxSeen.has(m.message_id); if(duplicate) duplicateCount++; inboxSeen.add(m.message_id);return json({duplicate,writes:duplicate?0:1});}),
    route('MEDIA_READ','https://api-data.line.me/v2/bot/message/12345678902/content','GET',10,
      options => authHeaders(options,ENV.LINE_CHANNEL_ACCESS_TOKEN), () => {inboxOrder.push('media-read'); return new Response(PNG);}),
    route('MEDIA_WRITE',INBOX+'/storage/v1/object/kk-inbox-media/line/'+Line.normalizeEvent(image()).message_id,'POST',10,
      options => {authHeaders(options,'synthetic-s1-inbox-key');assert.deepEqual(options.body,PNG);assert.equal(new Headers(options.headers).get('content-type'),'image/png');},
      () => {inboxOrder.push('media-write'); return json({saved:true});})
  );
  const active = id!=='ingress' && !id.startsWith('owner-');
  const repeats = ['disabled-inbox','mock-inbox','recovery','uncertain','claimed'].includes(id);
  const admitted = active && !['hidden','ambiguous','unavailable','missing-consent','mismatched-consent'].includes(id);
  const expected = {
    PUBLIC_EVENTS: active ? (repeats?2:1) : 0,
    PUBLIC_PACKAGES: active && !['hidden','ambiguous'].includes(id) ? (repeats?2:1) : 0,
    AUTH_RECEIPT: active && !['hidden','ambiguous','unavailable'].includes(id) ? (repeats?2:1) : 0,
    GAS_ACTION: admitted ? (['uncertain','claimed','swallowed-denial'].includes(id)?6:8) : 0,
    LINE_PUSH: admitted?1:0, LINE_REPLY: admitted&&!['uncertain','claimed'].includes(id)?1:0,
    POSTER_EVENTS: ['disabled-inbox','mock-inbox'].includes(id)?1:0,
    POSTER_BYTES: ['disabled-inbox','mock-inbox'].includes(id)?1:0,
    INBOX_PROFILE: inbox?(id==='mock-inbox'?4:id==='swallowed-denial'?0:2):0,
    INBOX_RPC: inbox?(id==='mock-inbox'?4:id==='swallowed-denial'?1:2):0,
    MEDIA_READ: inbox?(id==='mock-inbox'?2:id==='swallowed-denial'?0:1):0,
    MEDIA_WRITE: inbox?(id==='mock-inbox'?2:id==='swallowed-denial'?0:1):0
  };
  for(const item of routes) item.min=item.max=expected[item.id];
  // Exhaust profile on purpose: product catches this transport denial and returns 200.
  if (id==='swallowed-denial') routes.find(r=>r.id==='INBOX_PROFILE').max=0;
  const transport=createDummyTransport({routes}); transports.push(transport); global.fetch=transport.fetch;
  const priorWarn=console.warn,priorError=console.error;
  console.warn=()=>{};console.error=()=>{};
  try {
    if(id==='ingress') {
      result.statuses=[];
      for(const options of [{method:'GET'},{signature:'invalid'},{bytes:Buffer.from('{invalid')},
        {bytes:Buffer.alloc(1024*1024+1,32)},{bytes:Buffer.from('{"events":[]} '),signature:crypto.createHmac('sha256',ENV.LINE_CHANNEL_SECRET).update('{"events":[]}').digest('base64')}])
        result.statuses.push((await deliver(wrapper,[],options)).statusCode);
      return;
    }
    if(id.startsWith('owner-')) return await ownerScenario(wrapper,Webhook._test.OwnerApproval);
    const events=inbox&&id!=='swallowed-denial'?[image(),booking()]:[booking()];
    result.webhookStatus=(await deliver(wrapper,events)).statusCode; assert.equal(result.webhookStatus,200);
    if (id==='swallowed-denial') return;
    if(h.ledger.rows.length>1) originalPair.push(...h.ledger.rows.slice(1).map(r=>({id:r[0],booking:r[1],request:r[8],context:r[9],hash:r[10],message:r[11]})));
    if(['disabled-inbox','mock-inbox','recovery','uncertain','claimed'].includes(id)) {
      assert.equal(h.stats().allocations,1); assert.equal(h.ledger.rows.length,3);
      assert.equal((await deliver(wrapper,events)).statusCode,200);
      const after=h.ledger.rows.slice(1).map(r=>({id:r[0],booking:r[1],request:r[8],context:r[9],hash:r[10],message:r[11]}));
      for(let n=0;n<after.length;n++) {
        const {message: savedMessage,...saved}=originalPair[n], {message: currentMessage,...current}=after[n];
        assert.deepEqual(current,saved);
        if(savedMessage) assert.equal(currentMessage,savedMessage);
      }
      assert.equal(h.stats().allocations,1);
      result.originalPairRetained=true;result.frozenHashesVerified=true;
      for(const row of after) {assert.equal(sha(row.context),row.hash); if(row.message) assert.match(row.message,/^[a-f0-9]{64}$/);}
      assert.ok(contexts.every(c=>c===contexts[0]));
      if(id==='disabled-inbox'||id==='mock-inbox') {
        const customer=transport.calls.indexOf('LINE_REPLY'); assert.ok(customer>transport.calls.indexOf('LINE_PUSH'));
        assert.equal(capturedHero,'https://kk-phone-rental.vercel.app/api/line-poster?event_id=EVT-SYNTHETIC');
        const res=response(); await poster({method:'GET',url:capturedHero},res); result.posterApiCalls=1;
        assert.equal(res.statusCode,200);assert.deepEqual(res.body,PNG);
        assert.equal(res.headers['content-length'],String(PNG.length)); result.posterStatus=res.statusCode;result.posterType=res.headers['content-type'];
      }
    } else assert.equal(h.stats().allocations,0);
    if(inbox) {
      for(let n=0;n<inboxOrder.length;n++) if(inboxOrder[n]==='media-read') {
        assert.deepEqual(inboxOrder.slice(n-2,n+2),['profile','persist:image','media-read','media-write']);
      }
      result.mediaOrderingVerified=true;result.inboxDuplicates=duplicateCount;
    }
    result.allocations=h.stats().allocations;
    result.initialStates=h.ledger.rows.slice(1).map(r=>r[3]);
    result.safeStateHashes={fixtures:sha(eventCsv+'\n'+packageCsv+'\n'+PNG.toString('hex')),frozenContext:contexts.length?sha(contexts[0]):sha('none')};
    result.fixtureHashes={events:sha(eventCsv),packages:sha(packageCsv),png:sha(PNG)};
    transport.assertComplete(); guards.assertNoUnexpectedEgress();
  } finally {console.warn=priorWarn;console.error=priorError;}
}

async function ownerScenario(wrapper, Approval) {
  // This explicit mock models only the existing Node decision envelope contract.
  // It does not add decision APIs to the initial-outbox VM helper.
  const decision=id==='owner-confirm'?'approve':'reject', bid=id==='owner-confirm'?'BK-S1-CONFIRM':'BK-S1-REJECT';
  let terminal='', notifications=0;
  const order=[];
  const t=createDummyTransport({routes:[
    route('OWNER_DECISION_MOCK',GAS,'POST',3,options=>{
      const p=body(options); assert.deepEqual(p,{action:'decideLineBookingPending',booking_id:bid,decision:p.decision,
        apiKey:ENV.KK_ADMIN_API_KEY,source:'LINE_OWNER_APPROVAL',automation_version:Approval.VERSION});
      assert.ok(['approve','reject'].includes(p.decision));
    },options=>{
      const requested=body(options).decision, replay=Boolean(terminal);
      if(!terminal) terminal=requested;
      return json({ok:true,booking_id:bid,decision:terminal,booking_status:terminal==='approve'?'confirmed':'cancelled',
        customer_contact:CUSTOMER,idempotent_replay:replay});
    }),
    route('LINE_PUSH','https://api.line.me/v2/bot/message/push','POST',1,options=>{
      authHeaders(options,ENV.LINE_CHANNEL_ACCESS_TOKEN);assert.deepEqual(body(options),{to:CUSTOMER,messages:[Approval.customerDecisionMessage(decision,bid)]});
    },()=>{notifications++;order.push('customer-push');return json({sentMessages:[{id:'synthetic-decision-receipt'}]});}),
    route('LINE_REPLY','https://api.line.me/v2/bot/message/reply','POST',1,options=>{
      authHeaders(options,ENV.LINE_CHANNEL_ACCESS_TOKEN);assert.deepEqual(body(options),{replyToken:'synthetic-owner-reply',messages:[Approval.ownerDecisionMessage(decision,bid)]});
    },()=>{order.push('owner-ack');return json({sentMessages:[{id:'synthetic-owner-ack'}]});})
  ].map(item=>({...item,min:item.max}))});transports.push(t);global.fetch=t.fetch;
  function event(d,actor=OWNER) {return {type:'postback',source:{type:'user',userId:actor},replyToken:'synthetic-owner-reply',postback:{data:Approval.decisionData(d,bid,process.env)}};}
  assert.equal((await deliver(wrapper,[event(decision,CUSTOMER)])).statusCode,200);
  assert.equal(t.calls.length,0);
  assert.equal((await deliver(wrapper,[event(decision)])).statusCode,200);
  assert.equal((await deliver(wrapper,[event(decision)])).statusCode,200);
  // Conflicting decision readback fails closed; the mock terminal state remains first decision.
  assert.equal((await deliver(wrapper,[event(decision==='approve'?'reject':'approve')])).statusCode,500);
  assert.equal(terminal,decision);assert.equal(notifications,1);assert.deepEqual(order,['customer-push','owner-ack']);
  result.decisionEvidence='NODE_CONTRACT_MOCK_UPSTREAM';result.ownerAckSeparate=true;result.terminalDecisionRetained=true;
  result.safeStateHashes={booking:sha(bid),decision:sha(terminal)};t.assertComplete();
}

(async () => {
  if(mode==='regression') {
    assert.ok(Object.hasOwn(REGRESSIONS,id),'REGRESSION_NOT_ALLOWLISTED');
    for(const key of Object.keys(process.env)) assert.ok(['LANG','TZ','SystemRoot'].includes(key),'UNEXPECTED_CHILD_ENV');
    require(REGRESSIONS[id]); // node:test auto-runs in this same guarded process; descendants remain denied.
  } else {
    assert.equal(mode,'scenario');assert.ok(SCENARIOS.includes(id),'SCENARIO_NOT_ALLOWLISTED');
    if(id==='guard-proof') await guardProof();
    else if(id==='transport-proof') await transportProof();
    else await rehearsal();
  }
})().catch(() => failure('SCENARIO_ASSERTION'));
