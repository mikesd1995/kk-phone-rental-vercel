// Synthetic native proof only. No provider or external database connections.
import {fileURLToPath} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../',import.meta.url));
const db=new PGlite(); const results=[];
const headers=['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const iso=n=>new Date(n).toISOString();
async function rpc(op,p){
 if(op==='tickets'&&p&&!Object.hasOwn(p,'held'))p={...p,held:[]};
 await db.exec('set role service_role');
 try{return (await db.query('select public.kk_owner_canonical_operation($1,$2::jsonb,$3) as result',[op,p===undefined?null:JSON.stringify(p),'preview'])).rows[0].result;}
 finally{await db.exec('reset role');}
}
async function rejects(fn,pattern){let error;try{await fn();}catch(e){error=e;}assert.ok(error,'expected rejection');if(pattern)assert.match(error.message,pattern);return error;}
async function reset(){
 await db.exec('truncate public.kk_owner_canonical_delivery, public.kk_owner_canonical_ticket, public.kk_owner_canonical_poll, public.kk_owner_canonical_cutover cascade');
 const at=Date.now()-901000;
 await db.query('insert into public.kk_owner_canonical_cutover(cutover_id,activated_at,policy_version,consumer_id,environment,enabled) values($1,$2,$3,$4,$5,true)',[crypto.randomUUID(),iso(at),'v4.9.44','6176241','preview']);
 const context=await rpc('poll',{});
 const row=Object.assign(Object.fromEntries(headers.map(k=>[k,''])),{'Notification ID':'native-normal-'+crypto.randomUUID(),'Created At':iso(at+1000),'Event Family ID':'native-family','Show ID':'native-show','Change Type':'CANCELLATION',Priority:'P0','Quiet Hours Policy':'DEFAULT',Payload:'Synthetic SQL contract only','Audit Event ID':'native-audit','Transport':'TELEGRAM_OWNER_ALERTS',Status:'QUEUED','Attempt Count':0,'Dedup Key':'native-dedup-'+crypto.randomUUID()});
 return {context,row};
}
async function claim(f){const tickets=await rpc('tickets',{context:f.context,rows:[f.row],candidates:[f.row['Notification ID']]});const ticket=tickets[0];await rpc('begin',{ticket});return {...f,ticket};}
function envelope(f){
 const now=Date.now(),claimId='CLAIM|'+crypto.randomUUID(),claimed={...f.row,Status:'SENDING','Attempt Count':1,'Last Attempt At':iso(now),Notes:claimId};
 const binding=JSON.stringify(['kk-owner-ledger-binding-v2','1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo','_Notification_Ledger','TELEGRAM_OWNER_ALERTS',f.row['Notification ID'],f.row['Created At'],f.row.Payload,f.row['Dedup Key'],f.row['Event Family ID'],f.row['Show ID'],f.row['Change Type'],f.row.Priority,f.row['Quiet Hours Policy'],JSON.stringify(f.context),claimId]);
 const suffix=Buffer.from(f.row['Notification ID']).toString('base64url');
 const descriptor={version:'kk-make-owner-transport-v1',audience:'KK_OWNER_TELEGRAM_ONLY',notification_id:'ks1_'+suffix,request_id:'kr1_'+suffix,event_type:'OWNER_ALERT',entity_id:'ke1_'+suffix,content_version:hash(binding),text:'Synthetic SQL contract only',created_at:iso(now),expires_at:iso(now+120000)};
 return {ticket:f.ticket,binding,descriptor,claimed_row:claimed};
}
async function test(name,fn){try{await fn();results.push({name,passed:true});}catch(e){results.push({name,passed:false,code:e.code||null,message:e.message});}}
try{
 await db.exec('create role anon; create role authenticated; create role service_role');
 await db.exec(await fs.readFile(repo+'/supabase/staging/kk-owner-ledger-canonical-v2.sql','utf8'));
 await test('default-OFF with no trusted epoch denies poll',async()=>{await rejects(()=>rpc('poll',{}),/DISABLED/);});
 await test('anon and authenticated cannot execute canonical RPC',async()=>{for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await rejects(()=>db.query("select public.kk_owner_canonical_operation('poll','{}','preview')"),/permission denied/);}finally{await db.exec('reset role');}}});
 await test('service_role cannot directly mutate canonical tables',async()=>{await db.exec('set role service_role');try{for(const table of ['cutover','poll','ticket','delivery'])await rejects(()=>db.exec('delete from public.kk_owner_canonical_'+table),/permission denied/);}finally{await db.exec('reset role');}});
 await test('poll strict parameters reject SQL NULL and caller overrides',async()=>{await reset();await rejects(()=>rpc('poll',undefined),/INVALID|FORBIDDEN/);await rejects(()=>rpc('poll',{enabled:true}),/INVALID|FORBIDDEN/);});
 await test('same consumer slot cannot mint a second poll',async()=>{await reset();await rejects(()=>rpc('poll',{}));});
 await test('post-cutover source older than 120 seconds is preserved',async()=>{const f=await claim(await reset());const p=envelope(f),r=await rpc('enqueue',p);assert.equal(r.source_row['Created At'],f.row['Created At']);assert.ok(Date.now()-Date.parse(r.source_row['Created At'])>120000);assert.equal(r.descriptor.created_at,p.descriptor.created_at);});
 await test('pre-cutover, UAT, evidence and duplicate source rows are denied',async()=>{for(const mutation of [r=>r['Created At']='2000-01-01T00:00:00.000Z',r=>r.Priority='TEST',r=>r['Change Type']='TRANSPORT_UAT',r=>r['Delivery Evidence']='unknown',r=>r.Status='RETRY_WAIT']){const f=await reset();mutation(f.row);await rejects(()=>rpc('tickets',{context:f.context,rows:[f.row],candidates:[f.row['Notification ID']]}));}const f=await reset();await rejects(()=>rpc('tickets',{context:f.context,rows:[f.row,{...f.row}],candidates:[f.row['Notification ID']]}),/AMBIGUOUS/);});
 await test('null business fields cannot become canonical tickets',async()=>{for(const key of ['Created At','Event Family ID','Change Type','Priority','Payload','Audit Event ID','Transport','Dedup Key','Status']){const f=await reset();f.row[key]=null;await rejects(()=>rpc('tickets',{context:f.context,rows:[f.row],candidates:[f.row['Notification ID']]}));}});
 await test('forged and stale poll contexts cannot issue tickets',async()=>{for(const mutation of [c=>c.consumer_id='other',c=>c.observed_at='2000-01-01T00:00:00.000Z']){const f=await reset();mutation(f.context);await rejects(()=>rpc('tickets',{context:f.context,rows:[f.row],candidates:[f.row['Notification ID']]}),/MISMATCH|EXPIRED/);}});
 await test('ticket issuance and begin are consumed once',async()=>{const f=await reset(),params={context:f.context,rows:[f.row],candidates:[f.row['Notification ID']]},tickets=await rpc('tickets',params);await rejects(()=>rpc('tickets',params),/REPLAY/);await rpc('begin',{ticket:tickets[0]});await rejects(()=>rpc('begin',{ticket:tickets[0]}),/CONSUMED/);});
 await test('original source, full claimed row and original TTL are immutable',async()=>{const f=await claim(await reset()),p=envelope(f);const changed=JSON.parse(p.binding);changed[5]=p.descriptor.created_at;await rejects(()=>rpc('enqueue',{...p,binding:JSON.stringify(changed)}),/IMMUTABLE/);await rejects(()=>rpc('enqueue',{...p,claimed_row:{...p.claimed_row,Payload:'tampered'}}),/CAS/);await rejects(()=>rpc('enqueue',{...p,descriptor:{...p.descriptor,expires_at:iso(Date.parse(p.descriptor.created_at)+120001)}}),/TTL/);const r=await rpc('enqueue',p);assert.equal(r.status,'QUEUED');await rejects(()=>rpc('enqueue',p),/FENCED/);});
 await test('descriptor nulls cannot pass native admission guards',async()=>{for(const key of ['version','audience','notification_id','request_id','entity_id','content_version','text','created_at','expires_at']){const f=await claim(await reset()),p=envelope(f);p.descriptor[key]=null;await rejects(()=>rpc('enqueue',p));}});
 await test('reserve once, invalid/null ACK denied, exact synthetic ACK idempotent',async()=>{const f=await claim(await reset()),p=envelope(f),r=await rpc('enqueue',p),reservation=await rpc('reserve',{notification_id:r.notification_id});await rejects(()=>rpc('reserve',{notification_id:r.notification_id}),/ATTEMPTED/);for(const bad of [{receipt_id:null,provider_message_id:'123'},{receipt_id:reservation.receipt_id,provider_message_id:null},{receipt_id:crypto.randomUUID(),provider_message_id:'123'},{receipt_id:reservation.receipt_id,provider_message_id:'0'}])await rejects(()=>rpc('ack',{notification_id:r.notification_id,...bad}),/ACK|INVALID/);const params={notification_id:r.notification_id,receipt_id:reservation.receipt_id,provider_message_id:'123456789'},sent=await rpc('ack',params);assert.equal(sent.status,'SENT');assert.equal((await rpc('ack',params)).receipt_id,reservation.receipt_id);await rejects(()=>rpc('reserve',{notification_id:r.notification_id}),/ATTEMPTED/);const readback=await rpc('readback',{notification_id:r.notification_id});assert.equal(readback.provider_message_id,params.provider_message_id);});
 await test('expired attempted descriptor remains fenced and original times remain unchanged',async()=>{const f=await claim(await reset()),p=envelope(f);p.descriptor.expires_at=iso(Date.now()+1000);const r=await rpc('enqueue',p),reserved=await rpc('reserve',{notification_id:r.notification_id});await new Promise(resolve=>setTimeout(resolve,1100));await rejects(()=>rpc('ack',{notification_id:r.notification_id,receipt_id:reserved.receipt_id,provider_message_id:'123456789'}),/EXPIRED/);await rejects(()=>rpc('reserve',{notification_id:r.notification_id}),/EXPIRED/);const read=await rpc('readback',{notification_id:r.notification_id});assert.equal(read.status,'RESERVED');assert.equal(read.descriptor.expires_at,p.descriptor.expires_at);assert.equal(read.provider_message_id,null);});
 await test('durable synthetic SENT readback survives expiry without another reserve',async()=>{const f=await claim(await reset()),p=envelope(f);p.descriptor.expires_at=iso(Date.now()+1000);const r=await rpc('enqueue',p),reserved=await rpc('reserve',{notification_id:r.notification_id});await rpc('ack',{notification_id:r.notification_id,receipt_id:reserved.receipt_id,provider_message_id:'123456789'});await new Promise(resolve=>setTimeout(resolve,1100));const read=await rpc('readback',{notification_id:r.notification_id});assert.equal(read.status,'SENT');assert.equal(read.descriptor.expires_at,p.descriptor.expires_at);assert.equal(read.receipt_id,reserved.receipt_id);await rejects(()=>rpc('reserve',{notification_id:r.notification_id}),/EXPIRED/);});
 await test('no reset/retry operation can revive unknown attempt',async()=>{const f=await claim(await reset());for(const op of ['reset','retry','renew','replay'])await rejects(()=>rpc(op,{ticket:f.ticket}),/FORBIDDEN/);});
 await test('trusted cutover epoch cannot be rewritten under existing poll identity',async()=>{await reset();await rejects(()=>db.exec("update public.kk_owner_canonical_cutover set activated_at=activated_at-interval '1 second'"),/IMMUTABLE/);});
 await test('native payload and descriptor UTF16 limits match JavaScript wire limits',async()=>{const f=await reset();f.row.Payload='🧪'.repeat(1025);await rejects(()=>rpc('tickets',{context:f.context,rows:[f.row],candidates:[f.row['Notification ID']]}),/PAYLOAD|SOURCE/);const g=await claim(await reset()),p=envelope(g);p.descriptor.text='🧪'.repeat(1025);await rejects(()=>rpc('enqueue',p),/DESCRIPTOR|PAYLOAD/);});
 await test('F2 missing, null, empty, typed and malformed claimed timestamps never persist a descriptor or become reservable',async()=>{
  for(const value of [undefined,null,'',0,{},[],'not-a-date','infinity','-infinity']){
   const f=await claim(await reset()),p=envelope(f);if(value===undefined)delete p.claimed_row['Last Attempt At'];else p.claimed_row['Last Attempt At']=value;
   await rejects(()=>rpc('enqueue',p));const row=(await db.query('select status,descriptor from public.kk_owner_canonical_delivery where ticket=$1',[f.ticket])).rows[0];assert.equal(row.status,'CLAIMING');assert.equal(row.descriptor,null);
   await rejects(()=>rpc('reserve',{notification_id:p.descriptor.notification_id}));
  }
  const f=await claim(await reset()),p=envelope(f);assert.equal((await rpc('enqueue',p)).status,'QUEUED');
 });
 await test('F1 bounded hash-only held debt persists for native poll readback without claiming invalid rows',async()=>{
  const f=await reset(),bad={...f.row,'Notification ID':'bad','Dedup Key':'invalid-native-dedup',Payload:'missing source'},held=[{row_index:2,notification_id_sha256:hash(JSON.stringify(bad['Notification ID'])),reason_code:'CANONICAL_ID_INVALID'}];
  const tickets=await rpc('tickets',{context:f.context,rows:[f.row,bad],candidates:[f.row['Notification ID']],held});assert.equal(tickets.length,1);
  const read=await rpc('poll-readback',{poll_id:f.context.poll_id});assert.deepEqual(read.held,held);assert.equal(read.issued,true);
  assert.equal((await db.query('select count(*)::integer as n from public.kk_owner_canonical_delivery')).rows[0].n,0);
  const g=await reset();for(const malicious of [[{row_index:1,notification_id_sha256:hash(JSON.stringify(g.row['Notification ID'])),reason_code:'free text payload'}],[{row_index:1,notification_id_sha256:'0'.repeat(64),reason_code:'CANONICAL_RENDER_INVALID'}]])await rejects(()=>rpc('tickets',{context:g.context,rows:[g.row],candidates:[],held:malicious}),/HELD/);
 });
 await test('all canonical tables have RLS and RPC has fixed empty search_path',async()=>{const rows=(await db.query("select relname,relrowsecurity from pg_class where relname in ('kk_owner_canonical_cutover','kk_owner_canonical_poll','kk_owner_canonical_ticket','kk_owner_canonical_delivery')")).rows;assert.equal(rows.length,4);assert.ok(rows.every(r=>r.relrowsecurity));const fn=(await db.query("select prosecdef,proconfig from pg_proc where proname='kk_owner_canonical_operation'")).rows[0];assert.equal(fn.prosecdef,true);assert.ok(fn.proconfig.includes('search_path=\"\"'));});
}finally{await db.close();}
const proof={scope:'DISPOSABLE_NATIVE_SQL_SYNTHETIC_ONLY_NOT_PROVIDER_OR_PRODUCTION_PROOF',engine:'PostgreSQL18.6 PGlite0.5.11',source_sha256:hash(await fs.readFile(repo+'/supabase/staging/kk-owner-ledger-canonical-v2.sql','utf8')),passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,cases:results};
console.log(JSON.stringify(proof,null,2));
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){if(!process.argv[outputIndex+1])throw new Error('--output requires a path');await fs.writeFile(process.argv[outputIndex+1],JSON.stringify(proof,null,2)+'\n');}
if(proof.failed)process.exitCode=1;
