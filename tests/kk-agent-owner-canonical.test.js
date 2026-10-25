'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const V2=require('../server/make-owner-canonical'),Legacy=require('../server/make-owner-ledger-bridge');
const NOW='2026-10-25T05:15:01.000Z',secret='canonical-gas-secret-'.repeat(4);
function setup(){
 const stored={KK_OWNER_CANONICAL_ENABLED:'TRUE',KK_OWNER_CANONICAL_SECRET:secret,KK_OWNER_CANONICAL_CUTOVER_ID:'00000000-0000-4000-8000-000000000001',KK_OWNER_CANONICAL_ACTIVATED_AT:'2026-10-25T05:00:00.000Z',KK_OWNER_CANONICAL_ENVIRONMENT:'preview',CORE_V1_TRANSPORT_ENABLED:'TRUE'},rows=[Legacy.HEADERS.slice()];let writes=0;
 let clockNow=Date.parse(NOW);class Clock extends Date{constructor(...a){super(...(a.length?a:[clockNow]));}static now(){return clockNow;}}
 const lock={held:false,hasLock(){return this.held;},tryLock(){this.held=true;return true;},releaseLock(){this.held=false;}};
 const sheet={getName:()=>Legacy.TAB,getParent:()=>({getId:()=>Legacy.SPREADSHEET_ID}),getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),getRange:(r,c)=>({setValue(v){writes++;rows[r-1][c-1]=v;},setValues(vv){writes++;vv.forEach((v,i)=>v.forEach((x,j)=>rows[r+i-1][c+j-1]=x));}})};
 const ctx=vm.createContext({Date:Clock,console:{log(){throw Error('unexpected log');}},LockService:{getScriptLock:()=>lock},PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...stored})})},ScriptApp:{getScriptId:()=>Legacy.SCRIPT_PROJECT_ID},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){}},Utilities:{Charset:{UTF_8:'UTF_8'},DigestAlgorithm:{SHA_256:'SHA_256'},getUuid:()=>crypto.randomUUID(),newBlob:s=>({getBytes:()=>Array.from(Buffer.from(s))}),computeDigest:(_a,s)=>Array.from(crypto.createHash('sha256').update(s).digest()),computeHmacSha256Signature:(s,k)=>Array.from(crypto.createHmac('sha256',k).update(s).digest()),base64EncodeWebSafe:s=>Buffer.from(s).toString('base64url'),formatDate:()=> '12'},UrlFetchApp:{fetch(){throw Error('unexpected network');}}});
 for(const name of ['Code.gs','OwnerLedgerBridge.gs','CanonicalOwnerLedger.gs'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../apps-script/kk-agent',name),'utf8'),ctx);
 const context={version:'kk-owner-canonical-context-v2',cutover_id:stored.KK_OWNER_CANONICAL_CUTOVER_ID,activated_at:stored.KK_OWNER_CANONICAL_ACTIVATED_AT,policy_version:'v4.9.44',consumer_id:'6176241',script_project_id:Legacy.SCRIPT_PROJECT_ID,spreadsheet_id:Legacy.SPREADSHEET_ID,tab:Legacy.TAB,transport:Legacy.TRANSPORT,environment:'preview',poll_id:crypto.randomUUID(),slot_id:'1',due_at:'2026-10-25T05:15:00.000Z',observed_at:NOW,nonce:crypto.randomUUID()};
 const row=Object.assign(Object.fromEntries(Legacy.HEADERS.map(k=>[k,''])),{'Notification ID':'normal-event-123','Created At':'2026-10-25T05:00:01.000Z','Event Family ID':'family','Change Type':'MATERIAL_EVENT_UPDATE',Priority:'P1','Quiet Hours Policy':'DEFAULT',Payload:'งานทดสอบสัญญาเท่านั้น https://example.invalid/source แนะนำ: ตรวจสอบรายละเอียด','Audit Event ID':'audit123',Transport:Legacy.TRANSPORT,Status:'QUEUED','Attempt Count':0,'Dedup Key':'dedup123'});rows.push(Legacy.HEADERS.map(k=>row[k]));
 return {ctx,stored,rows,row,context,setNow(value){clockNow=value;},get writes(){return writes;}};
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('GAS authenticated canonical poll does not claim; fresh exact claim keeps original business cells and cannot replay',()=>{
 const h=setup();
 const pol=plain(h.ctx.runCanonicalOwnerLedgerPoll(V2.signContext('poll',h.context,{},secret)));V2.verifySigned(pol,'poll-result',{canonicalEnabled:true,canonicalSecret:secret},Date.parse(NOW));
 assert.deepEqual(pol.data.candidates,[h.row['Notification ID']]);assert.equal(h.writes,0);
 const data={ticket:crypto.randomUUID(),notification_id:h.row['Notification ID'],rows:pol.data.rows};
 const a=plain(h.ctx.runCanonicalOwnerLedgerClaim(V2.signContext('claim',h.context,data,secret)));assert.equal(a.data.claimed_row.Status,'SENDING');
 assert.equal(a.data.claimed_row['Created At'],h.row['Created At']);assert.equal(a.data.claimed_row.Payload,h.row.Payload);const writes=h.writes;
 assert.throws(()=>h.ctx.runCanonicalOwnerLedgerClaim(V2.signContext('claim',h.context,data,secret)),/SOURCE|ELIGIBLE|CLAIM/);assert.equal(h.writes,writes);
});
test('GAS default OFF, tampered context and row CAS reject before writes',()=>{
 for(const mode of ['off','global-off','signature','cutover','snapshot']){const h=setup(),data={ticket:crypto.randomUUID(),notification_id:h.row['Notification ID'],rows:[h.row]};let c=h.context;
 if(mode==='off')h.stored.KK_OWNER_CANONICAL_ENABLED='FALSE';if(mode==='cutover')c={...c,cutover_id:crypto.randomUUID()};if(mode==='snapshot')data.rows=[{...h.row,Payload:'different'}];
 if(mode==='global-off')h.stored.CORE_V1_TRANSPORT_ENABLED='FALSE';
 const a=V2.signContext('claim',c,data,secret);if(mode==='signature')a.signature='0'.repeat(64);
 assert.throws(()=>h.ctx.runCanonicalOwnerLedgerClaim(a));assert.equal(h.writes,0,mode);
 }
});
test('canonical mode fences competing timed Telegram before claim while LINE remains established',()=>{
 const h=setup();h.stored.CORE_V1_TRANSPORT_ENABLED='TRUE';h.ctx.openLedger_=()=>({sheet:{},headers:{},values:[]});
 h.ctx.collectCandidates_=()=>[{notificationId:'telegram',transport:'TELEGRAM_OWNER_ALERTS'},{notificationId:'line',transport:'LINE_OWNER_ALERTS'}];let processed=[];
 h.ctx.processCandidate_=(_s,_h,c)=>{processed.push(c.transport);return {status:'UNCHANGED_TEST'};};h.ctx.runCoreV1Notifier();assert.deepEqual(processed,['LINE_OWNER_ALERTS']);assert.equal(h.writes,0);
});
function integration(h){
 const cfg={canonicalEnabled:true,consumerAuthenticated:true,producerEnabled:true,canonicalSecret:secret,secret:'wire-secret-'.repeat(5),gasProjectId:Legacy.SCRIPT_PROJECT_ID,gasDeploymentId:'AKfycb_testdeployment',gasAccessToken:'test-only-token',storeMode:'vercel-oidc',expectedRef:Legacy.PROJECT_REF,ownerChatId:'-123456789'};
 const tickets=new Map(),records=new Map(),calls=[];let rejectProject=false,dropClaimResponse=false,pollRecord;
 const fetchImpl=async(url,init)=>{
  const body=JSON.parse(init.body);calls.push(body);
  if(url.startsWith('https://script.googleapis.com/')){
   if(body.function==='finalizeCanonicalOwnerLedgerAck'&&rejectProject)return {ok:true,json:async()=>({done:true,error:{message:'synthetic projection failure'}})};
   const result=plain(h.ctx[body.function](body.parameters[0]));if(body.function==='runCanonicalOwnerLedgerClaim'&&dropClaimResponse)return {ok:true,json:async()=>({done:true,error:{message:'synthetic lost claim result'}})};return {ok:true,json:async()=>({done:true,response:{result}})};
  }
  let result;const p=body.parameters;
  if(body.operation==='poll')result=h.context;
  if(body.operation==='tickets'){pollRecord={context:p.context,held:p.held,issued:true};result=p.candidates.map(notification_id=>{const ticket=crypto.randomUUID();tickets.set(ticket,{context:p.context,rows:p.rows,notification_id,state:'NEW'});return ticket;});}
  if(body.operation==='poll-readback')result=pollRecord;
  if(body.operation==='begin'){const t=tickets.get(p.ticket);assert.equal(t.state,'NEW');t.state='CLAIMING';result={context:t.context,rows:t.rows,notification_id:t.notification_id};}
  if(body.operation==='enqueue'){const t=tickets.get(p.ticket);assert.equal(t.state,'CLAIMING');t.state='ADMITTED';result={source_notification_id:t.notification_id,notification_id:p.descriptor.notification_id,context:t.context,source_row:t.rows.find(r=>r['Notification ID']===t.notification_id),claimed_row:p.claimed_row,binding_text:p.binding,descriptor:p.descriptor,status:'QUEUED',receipt_id:null,provider_message_id:null,reserved_at:null,delivered_at:null};records.set(p.descriptor.notification_id,result);}
  if(body.operation==='readback')result=records.get(p.notification_id);
  if(body.operation==='reserve'){const r=records.get(p.notification_id);if(r.status!=='QUEUED')throw Error('reserved already');Object.assign(r,{status:'RESERVED',receipt_id:crypto.randomUUID(),reserved_at:new Date(Date.now()).toISOString()});result={status:'RESERVED',receipt_id:r.receipt_id};}
  if(body.operation==='ack'){const r=records.get(p.notification_id);if(r.receipt_id!==p.receipt_id)throw Error('ACK mismatch');Object.assign(r,{status:'SENT',provider_message_id:p.provider_message_id,delivered_at:new Date(Date.now()).toISOString()});result=r;}
  return {ok:true,json:async()=>({ok:true,authenticated:true,version:'v2',project_ref:Legacy.PROJECT_REF,operation:body.operation,provider_sends:0,result:structuredClone(result)})};
 };
 return {calls,records,set rejectProject(v){rejectProject=v;},set dropClaimResponse(v){dropClaimResponse=v;},run:body=>V2.handle(body,cfg,{fetchImpl,getTokenImpl:async()=>'test-oidc'})};
}
test('actual gateway and GAS handle two iterator tickets JIT, durable ACK first and expired projection-only recovery',async t=>{
 const h=setup();let at=Date.parse(NOW);t.mock.method(Date,'now',()=>at);
 const second={...h.row,'Notification ID':'normal-event-456','Dedup Key':'dedup456'};h.rows.push(Legacy.HEADERS.map(k=>second[k]));
 const i=integration(h),poll=await i.run({stage:'canonical-poll',version:'v2'});assert.equal(poll.tickets.length,2);assert.equal(h.writes,0);assert.equal(i.records.size,0);
 const first=await i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[0].ticket});assert.equal(first.envelope_json,JSON.stringify(first.envelope));assert.equal(i.records.size,1);
 const prepared=await i.run({stage:'canonical-prepare',envelope:first.envelope});assert.equal(prepared.send_allowed,true);
 await assert.rejects(i.run({stage:'canonical-prepare',envelope:first.envelope}));
 await assert.rejects(i.run({stage:'canonical-ack',envelope:first.envelope,receipt_id:crypto.randomUUID(),provider_message_id:'123'}));
 const ack=await i.run({stage:'canonical-ack',envelope:first.envelope,receipt_id:prepared.receipt_id,provider_message_id:'123'});assert.equal(ack.projection_verified,false);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');
 i.rejectProject=true;await assert.rejects(i.run({stage:'canonical-project',envelope:first.envelope}));assert.equal(i.records.get(first.envelope.notification_id).status,'SENT');
 i.rejectProject=false;const secondAdmit=await i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[1].ticket});assert.equal(i.records.size,2);assert.equal(secondAdmit.envelope.entity_id.includes('undefined'),false);
 const originalExpiry=first.envelope.expires_at;at+=180000;h.setNow(at);h.stored.CORE_V1_TRANSPORT_ENABLED='FALSE';const before=i.calls.length;
 const projected=await i.run({stage:'canonical-project',envelope:first.envelope});assert.equal(projected.projection_verified,true);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENT');assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Created At')],h.row['Created At']);
 assert.equal(i.records.get(first.envelope.notification_id).descriptor.expires_at,originalExpiry);assert.ok(i.calls.slice(before).every(c=>!['reserve','ack'].includes(c.operation)));
 const writes=h.writes;await i.run({stage:'canonical-project',envelope:first.envelope});assert.equal(h.writes,writes);await assert.rejects(i.run({stage:'canonical-prepare',envelope:first.envelope}));
});
test('actual GAS quiet hours hold consumes no claim and next morning uses the same old post-cutover identity',()=>{
 const h=setup(),before=JSON.stringify(h.rows[1]);let at=Date.parse('2026-10-25T17:15:01.000Z');h.setNow(at);
 const quiet={...h.context,poll_id:crypto.randomUUID(),slot_id:'49',due_at:'2026-10-25T17:15:00.000Z',observed_at:new Date(at).toISOString()};
 const held=plain(h.ctx.runCanonicalOwnerLedgerPoll(V2.signContext('poll',quiet,{},secret)));assert.deepEqual(held.data.candidates,[]);assert.equal(h.writes,0);assert.equal(JSON.stringify(h.rows[1]),before);
 at=Date.parse('2026-10-26T00:00:01.000Z');h.setNow(at);const morning={...h.context,poll_id:crypto.randomUUID(),slot_id:'76',due_at:'2026-10-26T00:00:00.000Z',observed_at:new Date(at).toISOString()};
 const observed=plain(h.ctx.runCanonicalOwnerLedgerPoll(V2.signContext('poll',morning,{},secret)));assert.deepEqual(observed.data.candidates,[h.row['Notification ID']]);assert.equal(h.writes,0);
 const claimed=plain(h.ctx.runCanonicalOwnerLedgerClaim(V2.signContext('claim',morning,{ticket:crypto.randomUUID(),notification_id:h.row['Notification ID'],rows:observed.data.rows},secret)));assert.equal(claimed.data.claimed_row['Created At'],h.row['Created At']);
});
test('unknown GAS claim outcome fences the actual Sheet claim and consumed ticket without admission renewal',async t=>{
 t.mock.method(Date,'now',()=>Date.parse(NOW));const h=setup(),i=integration(h),poll=await i.run({stage:'canonical-poll',version:'v2'});i.dropClaimResponse=true;
 await assert.rejects(i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[0].ticket}));assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');assert.equal(i.records.size,0);assert.ok(i.calls.every(c=>c.operation!=='enqueue'));
 const writes=h.writes;await assert.rejects(i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[0].ticket}));assert.equal(h.writes,writes);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Created At')],h.row['Created At']);
});
test('F1 actual GAS and gateway isolate invalid normal rows as bounded operator-visible debt while valid rows admit',async t=>{
 t.mock.method(Date,'now',()=>Date.parse(NOW));
 for(const bad of [r=>r.Payload='missing source and action',r=>r.Payload='งาน https://example.invalid/source',r=>r.Payload=' '+r.Payload,r=>r.Payload='x'.repeat(2049),r=>r['Notification ID']='bad',r=>r.Payload=123]){
  const h=setup(),invalid={...h.row,'Notification ID':'invalid-normal-123','Dedup Key':'invalid-dedup123'};bad(invalid);h.rows.push(Legacy.HEADERS.map(k=>invalid[k]));const before=JSON.stringify(h.rows[2]),i=integration(h);
  const poll=await i.run({stage:'canonical-poll',version:'v2'});assert.equal(poll.tickets.length,1);assert.equal(poll.held.length,1);assert.equal(poll.held[0].row_index,2);assert.match(poll.held[0].notification_id_sha256,/^[a-f0-9]{64}$/);assert.equal(h.writes,0);assert.doesNotMatch(JSON.stringify(poll.held),/Payload|missing source|invalid-normal/);
  const read=await i.run({stage:'canonical-poll-readback',version:'v2',poll_id:poll.poll_id});assert.deepEqual(read.held,poll.held);
  const admitted=await i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[0].ticket});assert.equal(admitted.status,'ADMITTED');assert.equal(JSON.stringify(h.rows[2]),before);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Created At')],h.row['Created At']);
 }
});
test('F1 complete snapshot still holds both candidates sharing a malformed row dedup witness',async t=>{
 t.mock.method(Date,'now',()=>Date.parse(NOW));const h=setup(),bad={...h.row,'Notification ID':'bad',Payload:'invalid'};h.rows.push(Legacy.HEADERS.map(k=>bad[k]));const i=integration(h),poll=await i.run({stage:'canonical-poll',version:'v2'});
 assert.equal(poll.tickets.length,0);assert.equal(poll.held.length,2);assert.equal(poll.held[0].reason_code,'CANONICAL_DEDUP_AMBIGUOUS');assert.equal(h.writes,0);
});
test('F1 held identity hashes use fixed JSON type tags for exponent numbers and other non-string IDs across actual GAS/gateway',async t=>{
 t.mock.method(Date,'now',()=>Date.parse(NOW));
 for(const value of [1e-7,-1e-7,1e21,-1e21,true,null,[],{nested:1e-7}]){
  const h=setup(),bad={...h.row,'Notification ID':value,'Dedup Key':'invalid-typed-dedup'};h.rows.push(Legacy.HEADERS.map(k=>bad[k]));const before=JSON.stringify(h.rows[2]),i=integration(h),poll=await i.run({stage:'canonical-poll',version:'v2'});
  const type=value===null?'null':Array.isArray(value)?'array':typeof value,expected=crypto.createHash('sha256').update('KK_OWNER_CANONICAL_HELD_NONSTRING_V2\n'+type).digest('hex');
  assert.equal(poll.held[0].notification_id_sha256,expected);assert.equal(poll.held[0].reason_code,'CANONICAL_SOURCE_TYPE_INVALID');assert.equal(poll.tickets.length,1);assert.equal(h.writes,0);
  assert.deepEqual((await i.run({stage:'canonical-poll-readback',version:'v2',poll_id:poll.poll_id})).held,poll.held);assert.equal((await i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[0].ticket})).status,'ADMITTED');assert.equal(JSON.stringify(h.rows[2]),before);
 }
 const h=setup();for(const [index,value]of [1e-7,1e21].entries())h.rows.push(Legacy.HEADERS.map(k=>({...h.row,'Notification ID':value,'Dedup Key':'invalid-numeric-'+index})[k]));
 const original=JSON.stringify(h.rows.slice(2)),i=integration(h),poll=await i.run({stage:'canonical-poll',version:'v2'});assert.equal(poll.tickets.length,1);assert.equal(h.writes,0);assert.deepEqual(poll.held.map(x=>x.row_index),[2,3]);assert.equal(poll.held[0].notification_id_sha256,poll.held[1].notification_id_sha256);
 assert.deepEqual((await i.run({stage:'canonical-poll-readback',version:'v2',poll_id:poll.poll_id})).held,poll.held);assert.equal((await i.run({stage:'canonical-admit',version:'v2',ticket:poll.tickets[0].ticket})).status,'ADMITTED');assert.equal(JSON.stringify(h.rows.slice(2)),original);
});
