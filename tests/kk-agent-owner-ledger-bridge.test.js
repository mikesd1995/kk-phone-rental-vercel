'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const Contract=require('../server/make-owner-transport-contract');
const Plan=require('../server/make-owner-ledger-plan');
const NodeBridge=require('../server/make-owner-ledger-bridge');
const HEADERS=NodeBridge.HEADERS,NOW='2026-10-22T03:00:00.000Z';
const sourcePath=path.join(__dirname,'../apps-script/kk-agent/OwnerLedgerBridge.gs');
function setup(options={}){
  const stored={CORE_V1_TRANSPORT_ENABLED:'FALSE',KK_OWNER_LEDGER_PRODUCER_SECRET:'unit-producer-secret-which-is-over32bytes',KK_OWNER_LEDGER_PRODUCER_ENDPOINT:'https://kk-phone-rental-vercel-unit123-mikesd1995s-projects.vercel.app/api/kk-make-owner-notify?owner_transport=v1',...options.properties};
  const rows=[HEADERS.slice()],logs=[],propertyWrites=[];let fetches=0,writes=0,uuid=0;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[options.now||NOW]));}static now(){return Date.parse(options.now||NOW);}}
  const bytes=s=>Array.from(Buffer.from(s,'utf8'));
  const props={getProperties:()=>({...stored}),getProperty:k=>stored[k]||null,setProperty(k,v){propertyWrites.push([k,v]);if(options.onPropertySave&&options.onPropertySave(k,v)===false)return;stored[k]=v;},setProperties(o){propertyWrites.push(...Object.entries(o));if(options.onPropertiesSave&&options.onPropertiesSave(o,stored)===false)return;Object.assign(stored,o);},deleteProperty(k){delete stored[k];}};
  const lock={held:true,hasLock(){return this.held;},tryLock(){if(options.lockBusy)return false;this.held=true;return true;},releaseLock(){this.held=false;}};
  const sheet={getName:()=>NodeBridge.TAB,getParent:()=>({getId:()=>NodeBridge.SPREADSHEET_ID}),getLastRow:()=>rows.length,getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),getRange:(r,c,n,m)=>({setValues(values){writes++;if(options.onSheetWrite)options.onSheetWrite({r,c,values,rows,stored});values.forEach((row,i)=>{rows[r+i-1]=rows[r+i-1]||HEADERS.map(()=> '');row.forEach((v,j)=>rows[r+i-1][c+j-1]=v);});},setValue(v){writes++;rows[r-1][c-1]=v;}})};
  const utilities={Charset:{UTF_8:'UTF_8'},DigestAlgorithm:{SHA_256:'SHA_256'},getUuid:()=>options.uuids?.shift()||`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`,newBlob:s=>({getBytes:()=>bytes(s)}),computeDigest:(_alg,s)=>Array.from(crypto.createHash('sha256').update(s,'utf8').digest()),computeHmacSha256Signature:(s,key)=>Array.from(crypto.createHmac('sha256',key).update(s,'utf8').digest()),base64EncodeWebSafe:s=>Buffer.from(s,'utf8').toString('base64url')};
  const ctx=vm.createContext({Date:Clock,console:{log(...values){logs.push(values.join(' '));}},PropertiesService:{getScriptProperties:()=>props},LockService:{getScriptLock:()=>lock},ScriptApp:{getScriptId:()=>NodeBridge.SCRIPT_PROJECT_ID},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},Utilities:utilities,UrlFetchApp:{fetch(url,request){fetches++;if(options.onFetch)return options.onFetch(url,request,{stored,rows});throw new Error('UNIT_NETWORK_UNEXPECTED');}}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/kk-agent/Code.gs'),'utf8'),ctx);
  if(fs.existsSync(sourcePath))vm.runInContext(fs.readFileSync(sourcePath,'utf8'),ctx);
  return {ctx,stored,rows,sheet,lock,logs,propertyWrites,get fetches(){return fetches;},get writes(){return writes;}};
}
function claimFixture(h){const plan=h.ctx.prepareFreshOwnerTransportUatRows();h.lock.held=true;const candidate=h.ctx.collectCandidates_(h.rows,h.ctx.readHeaders_(HEADERS),h.stored,false,{controlledUatIds:h.ctx.parseCsvSet_(plan.notification_ids.join(',')),enforceQuietHours:true}).find(c=>c.transport==='TELEGRAM_OWNER_ALERTS');const claim=h.ctx.claimLedgerCandidate_(h.sheet,h.ctx.readHeaders_(HEADERS),candidate,h.stored);return {plan,candidate,claim};}
function response(body,status=200){return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(body)};}
function admitted(a){const p=Plan.planOwnerLedgerNotification({spreadsheet_id:NodeBridge.SPREADSHEET_ID,tab:NodeBridge.TAB,rows:a.before_rows,exact_notification_id:a.notification_id,fresh_since:'2026-10-22T02:58:00.000Z',supplied_now:NOW,existing_mapping_snapshot:[]});return {ok:true,status:'ADMITTED',send_allowed:false,source_notification_id:a.notification_id,sheet_claim_id:a.claim_id,envelope:Contract.buildEnvelope(p.descriptor,'different-transport-signing-secret',new Date(NOW))};}
test('fresh preparation creates exactly two labelled zero-attempt owner rows, disarmed and no network',()=>{const h=setup();const p=h.ctx.prepareFreshOwnerTransportUatRows();assert.equal(p.notification_ids.length,2);assert.equal(h.rows.length,3);assert.equal(h.fetches,0);assert.equal(h.stored.CORE_V1_TRANSPORT_ENABLED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');for(const row of h.rows.slice(1)){assert.equal(row[HEADERS.indexOf('Change Type')],'TRANSPORT_UAT');assert.equal(row[HEADERS.indexOf('Event Family ID')],'');assert.equal(row[HEADERS.indexOf('Attempt Count')],0);assert.equal(row[HEADERS.indexOf('Status')],'QUEUED');}});
test('preparation refuses global enabled before any sheet write',()=>{const h=setup({properties:{CORE_V1_TRANSPORT_ENABLED:'TRUE'}});assert.throws(()=>h.ctx.prepareFreshOwnerTransportUatRows(),/DISABLED/);assert.equal(h.writes,0);});
test('outbound producer HMAC matches Node canonical protocol and never calls a provider',()=>{let captured;const h=setup({onFetch(url,request){captured=JSON.parse(request.payload);assert.match(url,/kk-phone-rental-vercel-unit123-mikesd1995s-projects\.vercel\.app/);return response(admitted(captured.attestation));}});const {candidate,claim}=claimFixture(h);const result=h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored);assert.equal(result.deferred,true);const a=JSON.parse(JSON.stringify(captured.attestation));assert.equal(NodeBridge.verifyAttestation(a,{producerEnabled:true,producerSecret:h.stored.KK_OWNER_LEDGER_PRODUCER_SECRET,secret:'different'},Date.parse(NOW)).claim_id,claim.claim_id);assert.equal(h.fetches,1);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENDING');});
test('pending claim is durably saved before unknown admission network outcome and cannot resend',()=>{const h=setup({onFetch(_url,_request,state){assert.ok(Object.keys(state.stored).some(k=>k.startsWith('KK_OWNER_LEDGER_PENDING_')));throw new Error('timeout');}});const {candidate,claim}=claimFixture(h);assert.equal(h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored).deferred,true);assert.equal(h.ctx.getOwnerLedgerBridgeStatus(candidate.notificationId).status,'ADMISSION_UNKNOWN');assert.equal(h.fetches,1);assert.throws(()=>h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored),/PENDING|EXISTING/);assert.equal(h.fetches,1);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENDING');});
test('endpoint URL cannot redirect producer proof to another host',()=>{const h=setup({properties:{KK_OWNER_LEDGER_PRODUCER_ENDPOINT:'https://attacker.invalid/api/kk-make-owner-notify?owner_transport=v1'}});const {candidate,claim}=claimFixture(h);assert.throws(()=>h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored),/ENDPOINT/);assert.equal(h.fetches,0);});

test('producer endpoint accepts only the exact canonical gateway forms and the existing same-project Preview',()=>{for(const endpoint of ['https://kk-phone-rental.vercel.app/api/kk-make-owner-notify','https://kk-phone-rental.vercel.app/api/kk-make-owner-notify?owner_transport=v1','https://kk-phone-rental-vercel-unit123-mikesd1995s-projects.vercel.app/api/kk-make-owner-notify?owner_transport=v1']){const h=setup({properties:{KK_OWNER_LEDGER_PRODUCER_ENDPOINT:endpoint}});assert.equal(h.ctx.ownerLedgerBridgeConfig_(h.stored).endpoint,endpoint);assert.equal(h.fetches,0);assert.equal(h.writes,0);assert.equal(h.propertyWrites.length,0);}});

test('canonical producer binding rejects hostile suffixes, credentials, queries, fragments and paths',()=>{const base='https://kk-phone-rental.vercel.app/api/kk-make-owner-notify';for(const endpoint of ['http://kk-phone-rental.vercel.app/api/kk-make-owner-notify','https://kk-phone-rental.vercel.app.evil.invalid/api/kk-make-owner-notify','https://kk-phone-rental.vercel.app@evil.invalid/api/kk-make-owner-notify',base+'?owner_transport=v1&recipient=customer',base+'?owner_transport=v2',base+'?other=v1',base+'#fragment',base+'?owner_transport=v1#fragment',base+'/',base+'/../kk-admin','https://kk-phone-rental-vercel-unit123-other-team.vercel.app/api/kk-make-owner-notify?owner_transport=v1']){const h=setup({properties:{KK_OWNER_LEDGER_PRODUCER_ENDPOINT:endpoint}});assert.throws(()=>h.ctx.ownerLedgerBridgeConfig_(h.stored),/ENDPOINT_INVALID/,endpoint);assert.equal(h.fetches,0);assert.equal(h.writes,0);assert.equal(h.propertyWrites.length,0);}});
test('admit response with different source, claim or content binding cannot expose an envelope or destroy recovery claim',()=>{for(const bad of ['source','claim','content']){const h=setup({onFetch(_url,request){const a=JSON.parse(request.payload).attestation;const r=admitted(a);if(bad==='source')r.source_notification_id='another-id';if(bad==='claim')r.sheet_claim_id='CLAIM|foreign';if(bad==='content')r.envelope.content_version='f'.repeat(64);return response(r);}});const {candidate,claim}=claimFixture(h);assert.equal(h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored).deferred,true);assert.throws(()=>h.ctx.getPreparedOwnerLedgerBridgeEnvelope(candidate.notificationId),/NOT_PREPARED/);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENDING');}});
test('unconfirmed DB state cannot finalize a Sheet ACK',()=>{const h=setup({onFetch(_url,request){const body=JSON.parse(request.payload);return body.stage==='admit'?response(admitted(body.attestation)):response({ok:true,send_allowed:false,status:'QUEUED',source_notification_id:body.attestation.notification_id,sheet_claim_id:body.attestation.claim_id,record:{}});}});const {candidate,claim}=claimFixture(h);h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored);assert.throws(()=>h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId),/DURABLE|SENT/);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENDING');assert.equal(h.fetches,2);});
function durable(a,envelope){const descriptor=Object.fromEntries(Object.entries(envelope).filter(([k])=>k!=='signature'));const plan=Plan.planOwnerLedgerNotification({spreadsheet_id:NodeBridge.SPREADSHEET_ID,tab:NodeBridge.TAB,rows:a.before_rows,exact_notification_id:a.notification_id,fresh_since:'2026-10-22T02:58:00.000Z',supplied_now:NOW,existing_mapping_snapshot:[]});return {ok:true,send_allowed:false,status:'SENT',source_notification_id:a.notification_id,sheet_claim_id:a.claim_id,record:{mapping_record:plan.mapping_record,immutable_binding_text:JSON.stringify(plan.immutable_binding),source_audit_event_id:'CONTROLLED_UAT|'+a.notification_id,descriptor,text_sha256:plan.text_sha256,outbox:{...plan.descriptor,text_sha256:plan.text_sha256,status:'SENT',receipt_id:'00000000-0000-4000-8000-000000000099',reserved_at:NOW,delivered_at:'2026-10-22T03:00:01.000Z',provider_message_id:'123456789'}}};}
function sentHarness(transform){let admission,envelope;const options={onFetch(_url,request){const body=JSON.parse(request.payload);if(body.stage==='admit'){admission=body.attestation;const reply=admitted(admission);envelope=reply.envelope;return response(reply);}const reply=durable(admission,envelope);if(transform)transform(reply);return response(reply);}};const h=setup(options),f=claimFixture(h);h.ctx.KKOwnerTelegramBridge.send(f.candidate,f.claim,h.stored);options.now='2026-10-22T03:00:02.000Z';return {h,...f};}
test('native durable SENT is projected exactly once and repeat finalization is an exact read-only ACK',()=>{const {h,candidate}=sentHarness();const first=h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId);assert.equal(first.status,'SENT');assert.equal(first.api_accepted_at,'2026-10-22T03:00:01.000Z');const writes=h.writes;const second=h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId);assert.equal(second.status,'SENT');assert.equal(h.writes,writes);assert.equal(h.rows[1][HEADERS.indexOf('Delivery Confirmed At')],'');assert.equal(h.ctx.getOwnerLedgerBridgeStatus(candidate.notificationId).status,'SHEET_ACK_VERIFIED');});
test('native binding, provider, receipt or timestamp tampering never writes a Sheet ACK',()=>{for(const tamper of [r=>r.record.mapping_record.immutable_binding[6]='different',r=>r.record.outbox.provider_message_id='',r=>r.record.outbox.receipt_id=null,r=>r.record.outbox.delivered_at='2026-10-22T03:04:00.000Z']){const {h,candidate}=sentHarness(tamper);const before=h.writes;assert.throws(()=>h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId),/DURABLE|BINDING/);assert.equal(h.writes,before);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENDING');}});
test('foreign Sheet claim cannot be overwritten even by a valid durable receipt',()=>{const {h,candidate}=sentHarness();h.rows[1][HEADERS.indexOf('Notes')]='CLAIM|foreign';const before=h.writes;assert.throws(()=>h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId),/CLAIM|STATE|PROJECT/);assert.equal(h.writes,before);assert.equal(h.rows[1][HEADERS.indexOf('Notes')],'CLAIM|foreign');});
test('property failure after exact Sheet SENT can recover without another Sheet write',()=>{let admission,envelope,drop=true;const options={onPropertySave(_k,v){if(drop&&JSON.parse(v).status==='SHEET_ACK_VERIFIED')return false;},onFetch(_url,request){const body=JSON.parse(request.payload);if(body.stage==='admit'){admission=body.attestation;const reply=admitted(admission);envelope=reply.envelope;return response(reply);}return response(durable(admission,envelope));}};const h=setup(options),{candidate,claim}=claimFixture(h);h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored);options.now='2026-10-22T03:00:02.000Z';assert.throws(()=>h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId),/PROPERTY_READBACK/);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENT');const writes=h.writes;drop=false;assert.equal(h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId).status,'SENT');assert.equal(h.writes,writes);});
test('unknown admission can finish only from durable authenticated native receipt without re-admission',()=>{let admission,envelope;const options={onFetch(_url,request){const body=JSON.parse(request.payload);if(body.stage==='admit'){admission=body.attestation;envelope=admitted(admission).envelope;throw new Error('lost response');}return response(durable(admission,envelope));}};const h=setup(options),{candidate,claim}=claimFixture(h);assert.equal(h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored).deferred,true);options.now='2026-10-22T03:00:02.000Z';assert.equal(h.ctx.finalizeOwnerLedgerBridgeAck(candidate.notificationId).status,'SENT');assert.equal(h.fetches,2);});
test('single LINE helper creates no Telegram row and can execute only its own still-fresh test once',()=>{const h=setup({onFetch(url){assert.equal(url,'https://api.line.me/v2/bot/message/push');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({sentMessages:[{id:'123456789'}]}),getAllHeaders:()=>({'x-line-request-id':'line-unit-request-001'})};},properties:{LINE_CHANNEL_ACCESS_TOKEN:'unit-test-only-token',LINE_OWNER_USER_ID:'U00000000000000000000000000000000'}});const p=h.ctx.prepareOwnerLineUat();assert.equal(p.notification_ids.length,1);assert.equal(p.telegram_notification_id,'');assert.equal(h.rows.length,2);const r=h.ctx.runOwnerLineUat();assert.equal(r.results[0].status,'SENT');assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.fetches,1);assert.throws(()=>h.ctx.runOwnerLineUat(),/FRESH_IDENTITY/);assert.equal(h.fetches,1);});
test('lost local envelope persistence after native admission retains original recoverable claim',()=>{const h=setup({onPropertySave(_key,value){if(JSON.parse(value).status==='ADMITTED')return false;},onFetch(_url,request){return response(admitted(JSON.parse(request.payload).attestation));}});const {candidate,claim}=claimFixture(h);assert.equal(h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored).deferred,true);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'SENDING');assert.equal(h.ctx.getOwnerLedgerBridgeStatus(candidate.notificationId).status,'ADMISSION_PENDING');assert.equal(h.fetches,1);});

test('single LINE helper disarms its one-shot fuse even when Core cannot acquire its lock',()=>{const options={};const h=setup(options);h.ctx.prepareOwnerLineUat();options.lockBusy=true;const result=h.ctx.runOwnerLineUat();assert.equal(result.status,'UAT_LOCK_BUSY');assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_CONFIRMATION,undefined);assert.equal(h.fetches,0);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'QUEUED');});
test('single LINE helper disarms its one-shot fuse when Core throws before sending',()=>{const h=setup();h.ctx.prepareOwnerLineUat();h.ctx.runCoreV1ControlledUat=()=>{throw new Error('preflight failed');};assert.throws(()=>h.ctx.runOwnerLineUat(),/preflight failed/);assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_CONFIRMATION,undefined);assert.equal(h.fetches,0);});

for(const channel of ['Line','Telegram']){
  test(`${channel} UAT disarms when the arming write applies fuse fields then throws`,()=>{
    const options={onPropertiesSave(values,stored){if(values.CORE_V1_UAT_ARMED==='TRUE'){stored.CORE_V1_UAT_ARMED='TRUE';stored.CORE_V1_UAT_CONFIRMATION='SEND_ALLOWLISTED_OWNER_ALERTS';throw new Error('arming outcome unknown');}}};
    const h=setup(options);h.ctx[`prepareOwner${channel}Uat`]();const writes=h.writes;
    assert.throws(()=>h.ctx[`runOwner${channel}Uat`](),/arming outcome unknown/);
    assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_CONFIRMATION,undefined);
    assert.equal(h.rows[1][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.rows[1][HEADERS.indexOf('Attempt Count')],0);
    assert.equal(h.writes,writes);assert.equal(h.fetches,0);
  });
  test(`${channel} UAT reports failed disarm after an unknown arming write`,()=>{
    const options={onPropertiesSave(values,stored){if(values.CORE_V1_UAT_ARMED==='TRUE'){stored.CORE_V1_UAT_ARMED='TRUE';stored.CORE_V1_UAT_CONFIRMATION='SEND_ALLOWLISTED_OWNER_ALERTS';options.dropDisarm=true;throw new Error('arming outcome unknown');}},onPropertySave(k,v){if(options.dropDisarm&&k==='CORE_V1_UAT_ARMED'&&v==='FALSE')return false;}};
    const h=setup(options);h.ctx[`prepareOwner${channel}Uat`]();const writes=h.writes;
    assert.throws(()=>h.ctx[`runOwner${channel}Uat`](),/DISARM_READBACK_FAILED/);
    assert.equal(h.stored.CORE_V1_UAT_ARMED,'TRUE');assert.equal(h.stored.CORE_V1_UAT_CONFIRMATION,undefined);
    assert.equal(h.rows[1][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.rows[1][HEADERS.indexOf('Attempt Count')],0);
    assert.equal(h.writes,writes);assert.equal(h.fetches,0);
  });
}

test('Telegram editor preparation creates only one fresh disarmed TG row and preserves prior LINE rows',()=>{const h=setup();h.ctx.prepareOwnerLineUat();const line=JSON.stringify(h.rows[1]);assert.equal(typeof h.ctx.prepareOwnerTelegramUat,'function');assert.equal(h.ctx.prepareOwnerTelegramUat.length,0);const plan=h.ctx.prepareOwnerTelegramUat();assert.equal(plan.notification_ids.length,1);assert.equal(plan.line_notification_id,'');assert.equal(plan.notification_ids[0],plan.telegram_notification_id);assert.equal(h.rows.length,3);assert.equal(JSON.stringify(h.rows[1]),line);assert.equal(h.rows[2][HEADERS.indexOf('Transport')],'TELEGRAM_OWNER_ALERTS');assert.equal(h.rows[2][HEADERS.indexOf('Attempt Count')],0);assert.equal(h.rows[2][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.fetches,0);});

test('Telegram editor run checks producer binding before any arm, claim or network',()=>{for(const bad of [{KK_OWNER_LEDGER_PRODUCER_SECRET:''},{KK_OWNER_LEDGER_PRODUCER_ENDPOINT:'https://other.invalid/api/kk-make-owner-notify?owner_transport=v1'}]){const h=setup({properties:bad});h.ctx.prepareOwnerTelegramUat();const writes=h.writes,propertyWrites=h.propertyWrites.length;assert.throws(()=>h.ctx.runOwnerTelegramUat(),/SECRET_UNBOUND|ENDPOINT_INVALID/);assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,propertyWrites);assert.equal(h.rows[1][HEADERS.indexOf('Attempt Count')],0);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.fetches,0);}});

test('Telegram editor run rejects a mixed, mismatched, stale or enabled plan before arming',()=>{for(const kind of ['mixed','mismatch','stale','enabled','armed']){const options={};const h=setup(options);if(kind==='mixed')h.ctx.prepareFreshOwnerTransportUatRows();else h.ctx.prepareOwnerTelegramUat();if(kind==='mismatch'){const p=JSON.parse(h.stored.KK_OWNER_LEDGER_LAST_UAT_PLAN);p.notification_ids=['other-id'];h.stored.KK_OWNER_LEDGER_LAST_UAT_PLAN=JSON.stringify(p);}if(kind==='stale')options.now='2026-10-22T03:02:00.001Z';if(kind==='enabled')h.stored.CORE_V1_TRANSPORT_ENABLED='TRUE';if(kind==='armed')h.stored.CORE_V1_UAT_ARMED='TRUE';const writes=h.writes,propertyWrites=h.propertyWrites.length;assert.throws(()=>h.ctx.runOwnerTelegramUat(),/PLAN_REQUIRED|FRESH_IDENTITY|DISARMED/);assert.equal(h.writes,writes,kind);assert.equal(h.propertyWrites.length,propertyWrites,kind);assert.equal(h.fetches,0,kind);}});

test('Telegram editor run admits only its fresh target, logs no envelope and cannot send it twice',()=>{const h=setup({onFetch(url,request){assert.match(url,/\.vercel\.app\/api\/kk-make-owner-notify/);return response(admitted(JSON.parse(request.payload).attestation));}});const p=h.ctx.prepareOwnerTelegramUat();assert.equal(h.ctx.runOwnerTelegramUat.length,0);const result=h.ctx.runOwnerTelegramUat();assert.equal(result.processed,1);assert.equal(result.results[0].notification_id,p.telegram_notification_id);assert.equal(result.results[0].status,'SENDING');assert.equal(h.fetches,1);assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_CONFIRMATION,undefined);assert.equal(h.rows[1][HEADERS.indexOf('Attempt Count')],1);assert.doesNotMatch(h.logs.join('\n'),/signature|envelope|unit-producer-secret|PRODUCER_SECRET/);assert.throws(()=>h.ctx.runOwnerTelegramUat(),/FRESH_IDENTITY/);assert.equal(h.fetches,1);});

test('Telegram editor run disarms after lock busy or a Core preflight exception',()=>{for(const failure of ['busy','throw']){const options={};const h=setup(options);h.ctx.prepareOwnerTelegramUat();if(failure==='busy')options.lockBusy=true;else h.ctx.runCoreV1ControlledUat=()=>{throw new Error('Core preflight failed');};if(failure==='busy')assert.equal(h.ctx.runOwnerTelegramUat().status,'UAT_LOCK_BUSY');else assert.throws(()=>h.ctx.runOwnerTelegramUat(),/Core preflight failed/);assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_CONFIRMATION,undefined);assert.equal(h.rows[1][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.fetches,0);}});

test('Telegram editor run reports a failed disarm readback instead of claiming its fuse is OFF',()=>{const options={onPropertySave(k,v){if(options.dropDisarm && k==='CORE_V1_UAT_ARMED' && v==='FALSE')return false;}};const h=setup(options);h.ctx.prepareOwnerTelegramUat();options.lockBusy=true;options.dropDisarm=true;assert.throws(()=>h.ctx.runOwnerTelegramUat(),/DISARM_READBACK_FAILED/);assert.equal(h.stored.CORE_V1_UAT_ARMED,'TRUE');assert.equal(h.rows[1][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.fetches,0);});

test('last Telegram finalizer resolves only the exact single TG plan and logs a safe ACK summary',()=>{const h=setup();const p=h.ctx.prepareOwnerTelegramUat();let called;h.ctx.finalizeOwnerLedgerBridgeAck=id=>{called=id;return {notification_id:id,status:'SENT',transport:'TELEGRAM_OWNER_ALERTS',provider_message_id:'123456789',api_accepted_at:NOW,delivery_confirmed_at:'',envelope:{signature:'never-log'},producerSecret:'never-log'};};assert.equal(h.ctx.finalizeLastOwnerTelegramUatAck.length,0);const result=h.ctx.finalizeLastOwnerTelegramUatAck();assert.equal(called,p.telegram_notification_id);assert.equal(result.status,'SENT');assert.deepEqual(Object.keys(result).sort(),['api_accepted_at','delivery_confirmed_at','notification_id','provider_message_id','status','transport']);assert.equal(JSON.parse(h.logs[h.logs.length-1]).notification_id,called);assert.doesNotMatch(h.logs.join('\n'),/signature|envelope|producerSecret|never-log/);const before=h.fetches;h.ctx.prepareOwnerLineUat();assert.throws(()=>h.ctx.finalizeLastOwnerTelegramUatAck(),/PLAN_REQUIRED/);assert.equal(h.fetches,before);});

test('last Telegram finalizer preserves authenticated durable verification and exact idempotent Sheet projection',()=>{let admission,envelope;const options={onFetch(_url,request){const body=JSON.parse(request.payload);if(body.stage==='admit'){admission=body.attestation;const reply=admitted(admission);envelope=reply.envelope;return response(reply);}return response(durable(admission,envelope));}};const h=setup(options);const p=h.ctx.prepareOwnerTelegramUat();h.ctx.runOwnerTelegramUat();options.now='2026-10-22T03:00:02.000Z';const first=h.ctx.finalizeLastOwnerTelegramUatAck();assert.equal(first.notification_id,p.telegram_notification_id);assert.equal(first.status,'SENT');assert.equal(h.rows[1][HEADERS.indexOf('Provider Message ID')],'123456789');assert.equal(h.rows[1][HEADERS.indexOf('Delivery Confirmed At')],'');const writes=h.writes;assert.equal(h.ctx.finalizeLastOwnerTelegramUatAck().status,'SENT');assert.equal(h.writes,writes);assert.doesNotMatch(h.logs.join('\n'),/signature|envelope|unit-producer-secret/);});

const OLD_TG='KKUAT_TG_41097307-885b-4aa7-8da2-8db97d4b5e74',OLD_CLAIM='CLAIM|b871e6e4-ac71-45c8-8587-5f86c3158a16';
const GRANT='KK_OWNER_LEDGER_NEW_TG_UAT_GRANT',CONSUMED=GRANT+'_CONSUMED';
const digest=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');
function historicalUnknown(options={}){
  options.uuids=['41097307-885b-4aa7-8da2-8db97d4b5e74','b871e6e4-ac71-45c8-8587-5f86c3158a16'];
  const h=setup(options),plan=h.ctx.prepareOwnerTelegramUat();h.lock.held=true;
  const candidate=h.ctx.collectCandidates_(h.rows,h.ctx.readHeaders_(HEADERS),h.stored,false,{controlledUatIds:h.ctx.parseCsvSet_(plan.telegram_notification_id),enforceQuietHours:true})[0];
  const claim=h.ctx.claimLedgerCandidate_(h.sheet,h.ctx.readHeaders_(HEADERS),candidate,h.stored);h.ctx.KKOwnerTelegramBridge.send(candidate,claim,h.stored);
  options.now='2026-10-22T03:03:00.000Z';
  const pendingKey=Object.keys(h.stored).find(k=>k.startsWith('KK_OWNER_LEDGER_PENDING_'));
  const rowSnapshot=JSON.stringify(h.rows[1].map(v=>v instanceof Date?v.toISOString():v));
  const grant={version:'kk-owner-new-telegram-uat-grant-v1',grant_id:'d2698d69-5cb2-4fc0-91fe-93f00b895c81',owner_authorization_reference:'OWNER_2026-10-23_ONE_NEW_TELEGRAM_UAT',
    issued_at:options.now,expires_at:'2026-10-22T03:08:00.000Z',old_notification_id:OLD_TG,old_claim_id:OLD_CLAIM,
    old_pending_sha256:digest(h.stored[pendingKey]),old_claimed_row_sha256:digest(rowSnapshot),native_reconciliation_evidence_sha256:'a'.repeat(64)};
  h.stored[GRANT]=JSON.stringify(grant);return {h,options,pendingKey,grant};
}
test('historical preview exposes only safe exact hashes under the existing lock and never mutates',()=>{
  const {h,pendingKey}=historicalUnknown();const writes=h.writes,props=h.propertyWrites.length,fetches=h.fetches;
  assert.equal(typeof h.ctx.logOwnerHistoricalTelegramUatNoSendPreview,'function');assert.equal(h.ctx.logOwnerHistoricalTelegramUatNoSendPreview.length,0);
  const result=h.ctx.logOwnerHistoricalTelegramUatNoSendPreview();
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{notification_id:OLD_TG,claim_id:OLD_CLAIM,status:'ADMISSION_UNKNOWN',pending_sha256:digest(h.stored[pendingKey]),claimed_row_sha256:digest(JSON.stringify(h.rows[1].map(v=>v instanceof Date?v.toISOString():v)))});
  assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,props);assert.equal(h.fetches,fetches);assert.equal(h.lock.held,false);
  assert.doesNotMatch(h.logs.join('\n'),/signature|envelope|secret|Payload|candidate|"claimed_row":/i);
});
test('scoped one-time reconciliation prepares one new TG and preserves every old row and pending byte',()=>{
  const {h,pendingKey,grant}=historicalUnknown();const before=JSON.stringify(h.rows),pending=h.stored[pendingKey],fetches=h.fetches;
  assert.equal(typeof h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation,'function');assert.equal(h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation.length,0);
  const plan=h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation();
  assert.equal(h.rows.length,3);assert.equal(JSON.stringify(h.rows.slice(0,2)),before);assert.equal(h.stored[pendingKey],pending);assert.equal(h.fetches,fetches);
  assert.equal(plan.notification_ids.length,1);assert.equal(plan.telegram_notification_id,plan.notification_ids[0]);assert.notEqual(plan.telegram_notification_id,OLD_TG);assert.equal(plan.line_notification_id,'');
  assert.equal(h.rows[2][HEADERS.indexOf('Status')],'QUEUED');assert.equal(h.rows[2][HEADERS.indexOf('Attempt Count')],0);assert.equal(h.rows[2][HEADERS.indexOf('Priority')],'TEST');
  const consumed=JSON.parse(h.stored[CONSUMED]);assert.equal(consumed.grant.grant_id,grant.grant_id);assert.equal(consumed.new_notification_id,plan.telegram_notification_id);
  assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');assert.equal(h.stored.CORE_V1_TRANSPORT_ENABLED,'FALSE');
  const writes=h.writes;assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/CONSUMED/);assert.equal(h.writes,writes);
  for(const helper of ['prepareOwnerTelegramUat','prepareOwnerLineUat','prepareFreshOwnerTransportUatRows'])assert.throws(()=>h.ctx[helper](),/PENDING_RECONCILIATION/);
});
for(const bad of ['missing','extra','expired','future','longTTL','wrongId','wrongClaim','pendingHash','rowHash','evidenceHash','owner','armed','enabled','busy'])test(`scoped fresh grant rejects ${bad} before Sheet or consumption writes`,()=>{
  const {h,options,grant}=historicalUnknown();
  if(bad==='missing')delete h.stored[GRANT];if(bad==='extra')grant.extra=true;if(bad==='expired')grant.expires_at=grant.issued_at;
  if(bad==='future'){grant.issued_at='2026-10-22T03:03:01.000Z';}if(bad==='longTTL')grant.expires_at='2026-10-22T03:08:00.001Z';
  if(bad==='wrongId')grant.old_notification_id='KKUAT_TG_other';if(bad==='wrongClaim')grant.old_claim_id='CLAIM|other';
  if(bad==='pendingHash')grant.old_pending_sha256='b'.repeat(64);if(bad==='rowHash')grant.old_claimed_row_sha256='b'.repeat(64);if(bad==='evidenceHash')grant.native_reconciliation_evidence_sha256='';
  if(bad==='owner')grant.owner_authorization_reference='some-other-authority';if(bad==='armed')h.stored.CORE_V1_UAT_ARMED='TRUE';if(bad==='enabled')h.stored.CORE_V1_TRANSPORT_ENABLED='TRUE';if(bad==='busy')options.lockBusy=true;
  if(bad!=='missing')h.stored[GRANT]=JSON.stringify(grant);const writes=h.writes,props=h.propertyWrites.length,fetches=h.fetches;
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/GRANT|DISARMED|DISABLED|LOCK_BUSY/);
  assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,props);assert.equal(h.fetches,fetches);assert.equal(h.stored[CONSUMED],undefined);
});
for(const bad of ['admitted','pending','missing','otherPending','malformedPending','rowProvider','claimProvider','fresh','freshClaim','candidateSource','candidatePayload','candidateBefore','inconsistentBefore','rowState','claimedMismatch'])test(`scoped fresh grant rejects historical ${bad} instead of exempting a status class`,()=>{
  const {h,options,pendingKey,grant}=historicalUnknown(),pending=JSON.parse(h.stored[pendingKey]);
  if(bad==='admitted'){pending.status='ADMITTED';pending.envelope={signature:'never-allowed'};}if(bad==='pending')pending.status='ADMISSION_PENDING';
  if(bad==='otherPending')h.stored.KK_OWNER_LEDGER_PENDING_other=JSON.stringify({status:'ADMISSION_UNKNOWN'});
  if(bad==='malformedPending')h.stored.KK_OWNER_LEDGER_PENDING_other='not-json';
  if(bad==='rowProvider')h.rows[1][HEADERS.indexOf('Provider Message ID')]='123';if(bad==='claimProvider'){pending.claim.claimed_row['Provider Message ID']='123';h.rows[1][HEADERS.indexOf('Provider Message ID')]='123';}
  if(bad==='fresh')options.now='2026-10-22T03:01:59.999Z';if(bad==='candidateSource')pending.candidate.sourceSnapshot[7]='changed';
  if(bad==='freshClaim'){pending.claim.attempted_at='2026-10-22T03:02:00.000Z';pending.claim.claimed_row['Last Attempt At']=pending.claim.attempted_at;h.rows[1][HEADERS.indexOf('Last Attempt At')]=pending.claim.attempted_at;}
  if(bad==='candidatePayload')pending.candidate.payload='a different payload';if(bad==='candidateBefore')pending.claim.before_row.Payload='a different payload';
  if(bad==='inconsistentBefore'){pending.candidate.sourceRow['Feedback Source']='foreign';pending.claim.before_row['Feedback Source']='foreign';}
  if(bad==='rowState')h.rows[1][HEADERS.indexOf('Status')]='QUEUED';if(bad==='claimedMismatch')pending.claim.claimed_row.Notes='CLAIM|foreign';
  h.stored[pendingKey]=JSON.stringify(pending);grant.old_pending_sha256=digest(h.stored[pendingKey]);grant.old_claimed_row_sha256=digest(JSON.stringify(h.rows[1].map(v=>v instanceof Date?v.toISOString():v)));
  if(bad==='missing')delete h.stored[pendingKey];h.stored[GRANT]=JSON.stringify(grant);const writes=h.writes,props=h.propertyWrites.length,fetches=h.fetches;
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/HISTORICAL|RECONCILIATION|LEDGER_|GRANT/);
  assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,props);assert.equal(h.fetches,fetches);
});
test('consumption is verified before append and partial append uncertainty prevents another UUID or row',()=>{
  for(const mode of ['consumeDrop','consumeThrow','partialAppend']){
    const options={},f=historicalUnknown(options),{h}=f;let expectedId;
    if(mode==='consumeDrop')options.onPropertySave=(k)=>k!==CONSUMED;
    if(mode==='consumeThrow')options.onPropertySave=(k,v)=>{if(k===CONSUMED){h.stored[k]=v;throw new Error('consume outcome unknown');}};
    if(mode==='partialAppend')options.onSheetWrite=({rows,values,stored})=>{const consumed=JSON.parse(stored[CONSUMED]);expectedId=consumed.new_notification_id;assert.equal(values[0][0],expectedId);rows.push(values[0].slice());throw new Error('append outcome unknown');};
    const writes=h.writes;assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/GRANT|consume outcome|append outcome/);
    if(mode==='consumeDrop'){assert.equal(h.writes,writes);assert.equal(h.rows.length,2);}
    else {const consumed=h.stored[CONSUMED],rowCount=h.rows.length;assert.ok(consumed);assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/CONSUMED/);assert.equal(h.rows.length,rowCount);assert.equal(h.stored[CONSUMED],consumed);}
    if(mode==='partialAppend')assert.equal(h.rows[2][0],expectedId);
  }
});
for(const mode of ['oldRowChanged','oldPendingChanged','planWriteDropped'])test(`fresh preparation preserves a consumed uncertainty fence after ${mode}`,()=>{
  const options={}, {h,pendingKey}=historicalUnknown(options),previousPlan=h.stored.KK_OWNER_LEDGER_LAST_UAT_PLAN;
  if(mode==='oldRowChanged')options.onSheetWrite=({rows})=>{rows[1][HEADERS.indexOf('Feedback Source')]='foreign-write';};
  if(mode==='oldPendingChanged')options.onSheetWrite=({stored})=>{stored[pendingKey]+=' ';};
  if(mode==='planWriteDropped')options.onPropertiesSave=()=>false;
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/READBACK_FAILED/);
  assert.ok(h.stored[CONSUMED]);const rowCount=h.rows.length;assert.equal(h.stored.KK_OWNER_LEDGER_LAST_UAT_PLAN,previousPlan);
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/CONSUMED/);assert.equal(h.rows.length,rowCount);
});
for(const mode of ['rowCount','utf8Bytes'])test(`fresh preparation rejects prospective ${mode} snapshot bounds before consuming`,()=>{
  const {h}=historicalUnknown();
  if(mode==='rowCount')for(let i=0;i<127;i++){const row=HEADERS.map(()=> '');row[0]='HISTORICAL_OTHER_'+i;row[HEADERS.indexOf('Transport')]='OTHER';h.rows.push(row);}
  else {const row=HEADERS.map(()=> '');row[0]='HISTORICAL_OTHER';row[HEADERS.indexOf('Transport')]='OTHER';row[HEADERS.indexOf('Payload')]='😀'.repeat(66000);h.rows.push(row);}
  const writes=h.writes;assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/SNAPSHOT_BOUNDS/);assert.equal(h.writes,writes);assert.equal(h.stored[CONSUMED],undefined);
});
test('the consumed new fixture remains the only selectable TG identity while the historical send fence is unchanged',()=>{
  const {h}=historicalUnknown(),old=Object.values(h.stored).map(v=>{try{return JSON.parse(v);}catch{return null;}}).find(v=>v?.status==='ADMISSION_UNKNOWN');
  const before=h.fetches;h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation();h.lock.held=true;
  assert.throws(()=>h.ctx.KKOwnerTelegramBridge.send(old.candidate,old.claim,h.stored),/EXISTING_PENDING_NO_RESEND/);assert.equal(h.fetches,before);
  const candidates=h.ctx.collectCandidates_(h.rows,h.ctx.readHeaders_(HEADERS),h.stored,false,{controlledUatIds:h.ctx.parseCsvSet_(h.stored.CORE_V1_UAT_NOTIFICATION_IDS),enforceQuietHours:true});
  assert.equal(candidates.length,1);assert.notEqual(candidates[0].notificationId,OLD_TG);assert.equal(candidates[0].status,'QUEUED');
});

const EXPIRED_TG='KKUAT_TG_caf84575-743a-4cbe-8588-6e8ee6d2532c',EXPIRED_CLAIM='CLAIM|47af8985-f021-403e-bbbd-1f08dc73f8ed';
const RELAY_GRANT='KK_OWNER_LEDGER_RELAY_TG_UAT_GRANT_20261023',RELAY_CONSUMED=RELAY_GRANT+'_CONSUMED';
function twoHistoricalClaims(options={}){
  const f=historicalUnknown(options),{h}=f;
  options.uuids=['caf84575-743a-4cbe-8588-6e8ee6d2532c','47af8985-f021-403e-bbbd-1f08dc73f8ed'];
  h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation();
  options.onFetch=(_url,request)=>{const a=JSON.parse(request.payload).attestation;
    const plan=Plan.planOwnerLedgerNotification({spreadsheet_id:NodeBridge.SPREADSHEET_ID,tab:NodeBridge.TAB,rows:a.before_rows,exact_notification_id:a.notification_id,
      fresh_since:new Date(Date.parse(options.now)-120000).toISOString(),supplied_now:options.now,existing_mapping_snapshot:[]});
    return response({ok:true,status:'ADMITTED',send_allowed:false,source_notification_id:a.notification_id,sheet_claim_id:a.claim_id,
      envelope:Contract.buildEnvelope(plan.descriptor,'different-transport-signing-secret',new Date(options.now))});};
  h.ctx.runOwnerTelegramUat();options.now='2026-10-22T03:08:00.000Z';
  const keys=[OLD_TG,EXPIRED_TG].map(id=>h.ctx.ownerLedgerPendingKey_(id));
  const histories=keys.map((key,i)=>({notification_id:i?EXPIRED_TG:OLD_TG,claim_id:i?EXPIRED_CLAIM:OLD_CLAIM,
    pending_status:i?'ADMITTED':'ADMISSION_UNKNOWN',pending_sha256:digest(h.stored[key]),
    claimed_row_sha256:digest(JSON.stringify(h.rows[i+1].map(v=>v instanceof Date?v.toISOString():v)))}));
  const grant={version:'kk-owner-relay-telegram-uat-grant-v2',grant_id:'248f94ea-c185-4da1-9e67-84fd166b5814',
    owner_authorization_reference:'OWNER_2026-10-23_ONE_ADDITIONAL_NEW_TELEGRAM_UAT',issued_at:options.now,expires_at:'2026-10-22T03:13:00.000Z',
    prior_consumed_grant_sha256:digest(h.stored[CONSUMED]),historical_claims:histories,native_reconciliation_evidence_sha256:'e'.repeat(64)};
  h.stored[RELAY_GRANT]=JSON.stringify(grant);
  return {...f,keys,relayGrant:grant};
}
function refreshRelayHashes(f){
  f.relayGrant.prior_consumed_grant_sha256=digest(f.h.stored[CONSUMED]);
  f.relayGrant.historical_claims.forEach((v,i)=>{v.pending_sha256=digest(f.h.stored[f.keys[i]]);v.claimed_row_sha256=digest(JSON.stringify(f.h.rows[i+1].map(x=>x instanceof Date?x.toISOString():x)));});
  f.h.stored[RELAY_GRANT]=JSON.stringify(f.relayGrant);
}
test('relay preview logs exactly two pinned hash summaries and prior consumed hash without capability or writes',()=>{
  const {h,relayGrant}=twoHistoricalClaims(),writes=h.writes,props=h.propertyWrites.length,fetches=h.fetches;
  assert.equal(typeof h.ctx.logOwnerRelayTelegramUatNoSendPreview,'function');assert.equal(h.ctx.logOwnerRelayTelegramUatNoSendPreview.length,0);
  const preview=h.ctx.logOwnerRelayTelegramUatNoSendPreview();
  assert.deepEqual(JSON.parse(JSON.stringify(preview)),{historical_claims:relayGrant.historical_claims,prior_consumed_grant_sha256:relayGrant.prior_consumed_grant_sha256});
  assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,props);assert.equal(h.fetches,fetches);assert.equal(h.lock.held,false);
  assert.doesNotMatch(h.logs.join('\n'),/signature|envelope|secret|Payload|candidate|claimed_row":/i);
});
test('relay grant consumes separately before one new append and preserves both old claims, old consumed marker and every row',()=>{
  const {h,keys,relayGrant}=twoHistoricalClaims(),before=JSON.stringify(h.rows),pending=keys.map(k=>h.stored[k]),v1=h.stored[CONSUMED],fetches=h.fetches;
  assert.equal(typeof h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation,'function');assert.equal(h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation.length,0);
  const plan=h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation();
  assert.equal(h.rows.length,4);assert.equal(JSON.stringify(h.rows.slice(0,3)),before);assert.deepEqual(keys.map(k=>h.stored[k]),pending);assert.equal(h.stored[CONSUMED],v1);assert.equal(h.fetches,fetches);
  const consumed=JSON.parse(h.stored[RELAY_CONSUMED]);assert.equal(consumed.grant.grant_id,relayGrant.grant_id);assert.equal(consumed.new_notification_id,plan.telegram_notification_id);
  assert.equal(consumed.grant.prior_consumed_grant_sha256,digest(v1));assert.equal(plan.notification_ids.length,1);assert.equal(plan.line_notification_id,'');
  assert.ok(![OLD_TG,EXPIRED_TG].includes(plan.telegram_notification_id));assert.equal(h.rows[3][HEADERS.indexOf('Priority')],'TEST');assert.equal(h.rows[3][HEADERS.indexOf('Attempt Count')],0);
  assert.equal(h.stored.CORE_V1_TRANSPORT_ENABLED,'FALSE');assert.equal(h.stored.CORE_V1_UAT_ARMED,'FALSE');
  const logged=JSON.parse(h.logs.at(-1));assert.equal(logged.telegram_notification_id,plan.telegram_notification_id);
  assert.deepEqual(Object.keys(logged).sort(),['armed','created_at','fresh_until','provider_sends','status','telegram_content_version','telegram_notification_id']);
  assert.doesNotMatch(h.logs.join('\n'),/signature|envelope|unit-producer-secret/i);
  const writes=h.writes;assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation(),/CONSUMED/);assert.equal(h.writes,writes);
  for(const helper of ['prepareOwnerTelegramUat','prepareOwnerLineUat','prepareFreshOwnerTransportUatRows'])assert.throws(()=>h.ctx[helper](),/PENDING_RECONCILIATION/);
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterNoSendReconciliation(),/CONSUMED/);
  h.lock.held=true;for(const key of keys){const old=JSON.parse(h.stored[key]);assert.throws(()=>h.ctx.KKOwnerTelegramBridge.send(old.candidate,old.claim,h.stored),/EXISTING_PENDING_NO_RESEND/);}assert.equal(h.fetches,fetches);
});
for(const bad of ['missing','extra','wrongType','version','owner','uuid','sameUuid','expired','future','longTTL','noncanonicalDate','priorHash','nativeHash','historyCount','historyOrder','historyExtra','historyType','historyId','historyClaim','historyStatus','historyHash','rowHash','armed','enabled','confirmation','busy','script'])test(`relay grant rejects ${bad} without any new writes or network`,()=>{
  const f=twoHistoricalClaims(),{h,options,relayGrant:g}=f;
  if(bad==='missing')delete h.stored[RELAY_GRANT];if(bad==='extra')g.extra=true;if(bad==='wrongType')g.issued_at=9;if(bad==='version')g.version='kk-owner-new-telegram-uat-grant-v1';
  if(bad==='owner')g.owner_authorization_reference='OWNER_OLD';if(bad==='uuid')g.grant_id='not-a-uuid';if(bad==='sameUuid')g.grant_id=JSON.parse(h.stored[CONSUMED]).grant.grant_id;
  if(bad==='expired')g.expires_at=g.issued_at;if(bad==='future')g.issued_at='2026-10-22T03:08:00.001Z';if(bad==='longTTL')g.expires_at='2026-10-22T03:13:00.001Z';
  if(bad==='noncanonicalDate')g.issued_at='2026-10-22T03:08:00Z';if(bad==='priorHash')g.prior_consumed_grant_sha256='a'.repeat(64);if(bad==='nativeHash')g.native_reconciliation_evidence_sha256='';
  if(bad==='historyCount')g.historical_claims.pop();if(bad==='historyOrder')g.historical_claims.reverse();if(bad==='historyExtra')g.historical_claims[1].extra='x';if(bad==='historyType')g.historical_claims={0:g.historical_claims[0],1:g.historical_claims[1],length:2};
  if(bad==='historyId')g.historical_claims[1].notification_id=OLD_TG;if(bad==='historyClaim')g.historical_claims[1].claim_id=OLD_CLAIM;if(bad==='historyStatus')g.historical_claims[1].pending_status='ADMISSION_UNKNOWN';
  if(bad==='historyHash')g.historical_claims[1].pending_sha256='a'.repeat(64);if(bad==='rowHash')g.historical_claims[1].claimed_row_sha256='a'.repeat(64);
  if(bad==='armed')h.stored.CORE_V1_UAT_ARMED='TRUE';if(bad==='enabled')h.stored.CORE_V1_TRANSPORT_ENABLED='TRUE';if(bad==='confirmation')h.stored.CORE_V1_UAT_CONFIRMATION='SEND_ALLOWLISTED_OWNER_ALERTS';if(bad==='busy')options.lockBusy=true;
  if(bad==='script')h.ctx.ScriptApp.getScriptId=()=> 'wrong-script';if(bad!=='missing')h.stored[RELAY_GRANT]=JSON.stringify(g);
  const writes=h.writes,props=h.propertyWrites.length,fetches=h.fetches;assert.equal(typeof h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation,'function');
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation(),/GRANT|DISARMED|DISABLED|LOCK_BUSY|SCOPE/);assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,props);assert.equal(h.fetches,fetches);assert.equal(h.stored[RELAY_CONSUMED],undefined);
});
for(const bad of ['missingPrior','priorIdentity','priorStatus','priorGrant','freshSource','freshClaim','notExpired','unknownSecond','nonnullFirst','badSignature','badTtl','wrongEnvelopeId','wrongPayload','provider','claimMismatch','beforeMismatch','otherPending','malformedPending'])test(`relay isolation refuses historical ${bad} even when supplied hashes match`,()=>{
  const f=twoHistoricalClaims(),{h,options,keys}=f,pending=JSON.parse(h.stored[keys[1]]),prior=JSON.parse(h.stored[CONSUMED]);
  if(bad==='priorIdentity')prior.new_notification_id=OLD_TG;if(bad==='priorStatus')prior.status='SUCCESS';if(bad==='priorGrant')prior.grant.version='another-version';h.stored[CONSUMED]=JSON.stringify(prior);
  if(bad==='freshSource')options.now='2026-10-22T03:04:59.999Z';if(bad==='freshClaim'){pending.claim.attempted_at='2026-10-22T03:07:00.000Z';pending.claim.claimed_row['Last Attempt At']=pending.claim.attempted_at;h.rows[2][HEADERS.indexOf('Last Attempt At')]=pending.claim.attempted_at;}
  if(bad==='notExpired'){pending.envelope.created_at='2026-10-22T03:07:30.000Z';pending.envelope.expires_at='2026-10-22T03:09:30.000Z';}
  if(bad==='unknownSecond'){pending.status='ADMISSION_UNKNOWN';pending.envelope=null;}if(bad==='nonnullFirst'){const p=JSON.parse(h.stored[keys[0]]);p.envelope={signature:'private'};h.stored[keys[0]]=JSON.stringify(p);}
  if(bad==='badSignature')pending.envelope.signature='bad';if(bad==='badTtl')pending.envelope.expires_at='2026-10-22T03:05:00.001Z';if(bad==='wrongEnvelopeId')pending.envelope.notification_id='ks1_other';
  if(bad==='wrongPayload')pending.candidate.payload='different';if(bad==='provider'){pending.claim.claimed_row['Provider Message ID']='123';h.rows[2][HEADERS.indexOf('Provider Message ID')]='123';}
  if(bad==='claimMismatch')pending.claim.claim_id='CLAIM|foreign';if(bad==='beforeMismatch'){pending.candidate.sourceRow['Feedback Source']='foreign';pending.claim.before_row['Feedback Source']='foreign';}
  if(bad==='otherPending')h.stored.KK_OWNER_LEDGER_PENDING_foreign=JSON.stringify({status:'ADMISSION_UNKNOWN'});if(bad==='malformedPending')h.stored.KK_OWNER_LEDGER_PENDING_foreign='not-json';
  h.stored[keys[1]]=JSON.stringify(pending);refreshRelayHashes(f);if(bad==='missingPrior')delete h.stored[CONSUMED];
  const writes=h.writes,props=h.propertyWrites.length,fetches=h.fetches;assert.equal(typeof h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation,'function');
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation(),/HISTORICAL|RECONCILIATION|RELAY|GRANT|LEDGER_|TTL|BINDING/);assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,props);assert.equal(h.fetches,fetches);
});
for(const mode of ['consumeDrop','consumeThrow','partialAppend','priorChanged','pendingChanged','rowChanged','planDrop','rowCount','utf8Bytes','collision'])test(`relay consumption preserves uncertainty and no automatic second fixture after ${mode}`,()=>{
  const f=twoHistoricalClaims(),{h,options,keys}=f;
  if(mode==='consumeDrop')options.onPropertySave=k=>k!==RELAY_CONSUMED;
  if(mode==='consumeThrow')options.onPropertySave=(k,v)=>{if(k===RELAY_CONSUMED){h.stored[k]=v;throw new Error('consume outcome unknown');}};
  if(mode==='partialAppend')options.onSheetWrite=({rows,values})=>{rows.push(values[0].slice());throw new Error('append outcome unknown');};
  if(mode==='priorChanged')options.onSheetWrite=()=>{h.stored[CONSUMED]+=' ';};if(mode==='pendingChanged')options.onSheetWrite=()=>{h.stored[keys[1]]+=' ';};
  if(mode==='rowChanged')options.onSheetWrite=()=>{h.rows[1][HEADERS.indexOf('Feedback Source')]='foreign';};if(mode==='planDrop')options.onPropertiesSave=()=>false;
  if(mode==='rowCount')for(let i=0;i<126;i++){const row=HEADERS.map(()=> '');row[0]='OTHER_'+i;row[HEADERS.indexOf('Transport')]='OTHER';h.rows.push(row);}
  if(mode==='utf8Bytes'){const row=HEADERS.map(()=> '');row[0]='OTHER';row[HEADERS.indexOf('Transport')]='OTHER';row[HEADERS.indexOf('Payload')]='😀'.repeat(66000);h.rows.push(row);}
  if(mode==='collision')options.uuids=['caf84575-743a-4cbe-8588-6e8ee6d2532c'];
  const writes=h.writes,fetches=h.fetches;assert.equal(typeof h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation,'function');
  assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation(),/GRANT|consume outcome|append outcome|READBACK|SNAPSHOT_BOUNDS|COLLISION/);assert.equal(h.fetches,fetches);
  if(['consumeDrop','rowCount','utf8Bytes','collision'].includes(mode)){assert.equal(h.writes,writes);if(mode!=='consumeDrop')assert.equal(h.stored[RELAY_CONSUMED],undefined);}
  else {const consumed=h.stored[RELAY_CONSUMED],rowCount=h.rows.length;assert.ok(consumed);assert.throws(()=>h.ctx.prepareOwnerTelegramUatAfterRelayReconciliation(),/CONSUMED/);assert.equal(h.rows.length,rowCount);assert.equal(h.stored[RELAY_CONSUMED],consumed);}
});

function expiredInspectionFixture(text){
  const options={onFetch(_url,request){return response(admitted(JSON.parse(request.payload).attestation));}},h=setup(options),plan=h.ctx.prepareOwnerTelegramUat();
  if(text){
    const record=h.ctx.ledgerNamedRow_(h.rows[1],h.ctx.readHeaders_(HEADERS));record.Payload=text;h.rows[1][HEADERS.indexOf('Payload')]=text;
    plan.payload=text;plan.telegram_content_version=digest(JSON.stringify(h.ctx.ownerLedgerBinding_({notificationId:plan.telegram_notification_id,sourceRow:record})));
    h.stored.KK_OWNER_LEDGER_LAST_UAT_PLAN=JSON.stringify(plan);
  }
  const run=h.ctx.runOwnerTelegramUat();assert.equal(run.results[0].status,'SENDING',JSON.stringify(run));options.now='2026-10-22T03:04:00.000Z';
  const key=h.ctx.ownerLedgerPendingKey_(plan.telegram_notification_id),pending=JSON.parse(h.stored[key]);return {h,options,plan,key,pending};
}
test('read-only private chunks preserve the complete expired envelope without returning or logging a capability',()=>{
  const f=expiredInspectionFixture(),{h,pending,key}=f,props=JSON.stringify(h.stored),rows=JSON.stringify(h.rows),writes=h.writes,propWrites=h.propertyWrites.length,fetches=h.fetches,logs=h.logs.length;
  assert.equal(typeof h.ctx.inspectLastOwnerTelegramUatRelayReadOnly,'function');assert.equal(h.ctx.inspectLastOwnerTelegramUatRelayReadOnly.length,0);
  assert.equal(typeof h.ctx.ownerLedgerRelayReadOnlyCheckpoint_,'function');assert.equal(h.ctx.ownerLedgerRelayReadOnlyCheckpoint_.length,2);
  let captured,checkpointSummary;const original=h.ctx.ownerLedgerRelayReadOnlyCheckpoint_;
  h.ctx.ownerLedgerRelayReadOnlyCheckpoint_=(summary,chunks)=>{captured=Array.from(chunks);checkpointSummary=summary;return original(summary,chunks);};
  const result=h.ctx.inspectLastOwnerTelegramUatRelayReadOnly();
  assert.ok(captured.length>1);assert.ok(captured.every(s=>typeof s==='string'&&s.length>=1&&s.length<=80&&/^[A-Za-z0-9_-]+$/.test(s)));
  const decoded=Buffer.from(captured.join(''),'base64url').toString('utf8');assert.equal(decoded,JSON.stringify(pending.envelope));
  assert.deepEqual(JSON.parse(decoded),pending.envelope);assert.equal(h.stored[key],JSON.stringify(pending));
  assert.equal(result,checkpointSummary);assert.equal(Object.isFrozen(result),true);assert.equal(result.status,'READ_ONLY_RELAY_INSPECTION');assert.equal(result.expired,true);
  assert.equal(result.notification_id,pending.candidate.notificationId);assert.equal(result.field_count,11);assert.equal(result.chunk_count,captured.length);assert.equal(result.max_chunk_length,80);
  assert.equal(result.encoded_length,captured.join('').length);assert.equal(result.utf8_bytes,Buffer.byteLength(decoded,'utf8'));assert.equal(result.envelope_sha256,digest(decoded));
  assert.equal(result.text_sha256,digest(pending.envelope.text));assert.equal(result.text_length,pending.envelope.text.length);assert.equal(result.expires_at,pending.envelope.expires_at);assert.equal(result.provider_sends,0);
  assert.equal(result.envelope,undefined);assert.equal(result.chunks,undefined);assert.equal(result.signature,undefined);assert.equal(result.text,undefined);
  assert.equal(JSON.stringify(h.stored),props);assert.equal(JSON.stringify(h.rows),rows);assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,propWrites);assert.equal(h.fetches,fetches);assert.equal(h.logs.length,logs);assert.equal(h.lock.held,false);
  assert.throws(()=>h.ctx.getPreparedOwnerLedgerBridgeEnvelope(pending.candidate.notificationId),/TTL_INVALID/);
});
test('read-only relay chunks roundtrip long exact Unicode, quotes, backslashes, newline, emoji and legitimate ellipsis',()=>{
  const text='ทดสอบระบบแจ้งเตือน '+('คำไทย "quote" \\ path\n🙂 é… '.repeat(8))+'จบ',f=expiredInspectionFixture(text),{h,pending}=f;let chunks;
  h.ctx.ownerLedgerRelayReadOnlyCheckpoint_=(summary,parts)=>{chunks=Array.from(parts);return Object.freeze(summary);};
  const summary=h.ctx.inspectLastOwnerTelegramUatRelayReadOnly(),decoded=JSON.parse(Buffer.from(chunks.join(''),'base64url').toString('utf8'));
  assert.equal(decoded.text,text);assert.deepEqual(decoded,pending.envelope);assert.ok(chunks.every(s=>s.length<=80));assert.equal(summary.text_sha256,digest(text));assert.equal(summary.text_length,text.length);
});
test('read-only relay reads only whitelisted property keys and never the full property store',()=>{
  const {h,key}=expiredInspectionFixture(),store=h.ctx.PropertiesService.getScriptProperties(),get=store.getProperty,read=[];
  store.getProperties=()=>{throw new Error('BULK_SECRET_STORE_READ_FORBIDDEN');};store.getProperty=k=>{read.push(k);return get(k);};
  h.ctx.inspectLastOwnerTelegramUatRelayReadOnly();
  assert.deepEqual([...new Set(read)].sort(),['CORE_V1_TRANSPORT_ENABLED','CORE_V1_UAT_ARMED','CORE_V1_UAT_CONFIRMATION','CORE_V1_SPREADSHEET_ID','KK_OWNER_LEDGER_LAST_UAT_PLAN',key].sort());
});
for(const bad of ['enabled','armed','confirmation','busy','script','foreignSheet','mixedPlan','wrongPlan','planContent','planPayload','planCreated','planFreshUntil','pendingUnknown','pendingMissing','claim','candidatePayload','beforeRow','row','envelopeId','envelopeText','envelopeTTL','envelopeExtra'])test(`read-only complete-value inspection rejects ${bad} without any write, network or log`,()=>{
  const {h,options,plan,key,pending}=expiredInspectionFixture();
  if(bad==='enabled')h.stored.CORE_V1_TRANSPORT_ENABLED='TRUE';if(bad==='armed')h.stored.CORE_V1_UAT_ARMED='TRUE';if(bad==='confirmation')h.stored.CORE_V1_UAT_CONFIRMATION='SEND_ALLOWLISTED_OWNER_ALERTS';if(bad==='busy')options.lockBusy=true;
  if(bad==='script')h.ctx.ScriptApp.getScriptId=()=> 'wrong-script';if(bad==='foreignSheet')h.stored.CORE_V1_SPREADSHEET_ID='another-sheet';
  if(bad==='mixedPlan')plan.line_notification_id='OTHER';if(bad==='wrongPlan'){plan.telegram_notification_id='KKUAT_TG_other';plan.notification_ids=['KKUAT_TG_other'];}
  if(bad==='planContent')plan.telegram_content_version='f'.repeat(64);if(bad==='planPayload')plan.payload='other';if(bad==='planCreated')plan.created_at='2026-10-22T03:00:01.000Z';if(bad==='planFreshUntil')plan.fresh_until='2026-10-22T03:02:01.000Z';
  if(bad==='pendingUnknown')pending.status='ADMISSION_UNKNOWN';if(bad==='claim')pending.claim.claim_id='CLAIM|foreign';if(bad==='candidatePayload')pending.candidate.payload='other';
  if(bad==='beforeRow'){pending.candidate.sourceRow['Feedback Source']='foreign';pending.claim.before_row['Feedback Source']='foreign';}if(bad==='row')h.rows[1][HEADERS.indexOf('Notes')]='CLAIM|foreign';
  if(bad==='envelopeId')pending.envelope.notification_id='ks1_other';if(bad==='envelopeText')pending.envelope.text+='…';if(bad==='envelopeTTL')pending.envelope.expires_at='2026-10-22T03:02:00.001Z';if(bad==='envelopeExtra')pending.envelope.recipient='other';
  h.stored.KK_OWNER_LEDGER_LAST_UAT_PLAN=JSON.stringify(plan);h.stored[key]=JSON.stringify(pending);if(bad==='pendingMissing')delete h.stored[key];
  const props=JSON.stringify(h.stored),rows=JSON.stringify(h.rows),writes=h.writes,propWrites=h.propertyWrites.length,fetches=h.fetches,logs=h.logs.length;
  assert.equal(typeof h.ctx.inspectLastOwnerTelegramUatRelayReadOnly,'function');assert.throws(()=>h.ctx.inspectLastOwnerTelegramUatRelayReadOnly(),/OWNER_|LEDGER_/);
  assert.equal(JSON.stringify(h.stored),props);assert.equal(JSON.stringify(h.rows),rows);assert.equal(h.writes,writes);assert.equal(h.propertyWrites.length,propWrites);assert.equal(h.fetches,fetches);assert.equal(h.logs.length,logs);
});
