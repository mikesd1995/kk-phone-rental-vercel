'use strict';
// Optional QA only. Instantiates an isolated embedded PostgreSQL; never opens a
// URL, reads service credentials, or sends a real provider/customer message.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {createPostgrestStore}=require('../server/kk-inbox-postgrest-store');
const {sendOnce}=require('../server/kk-inbox-outbound-delivery');
const root=path.resolve(__dirname,'..');
const SOURCES=[
 'supabase/kk_inbox_v1.sql',
 'supabase/migrations/20261010213000_kk_inbox_private_line_media.sql',
 'supabase/migrations/20261013152000_kk_inbox_durable_outbound_reservations.sql',
 'supabase/migrations/20261013163000_kk_inbox_outbound_owner_review.sql'
];
const CID='conv_'+'a'.repeat(24),OTHER='conv_'+'b'.repeat(24),XROOM='conv_'+'c'.repeat(24);
const USER='U'+'a'.repeat(32),OTHER_USER='U'+'b'.repeat(32),DIGEST='a'.repeat(64);
const KEY='SYNTHETIC_QA_PRIVATE_KEY',BODY='Synthetic outbound acceptance only';

async function main(){
 const modulePath=process.env.KK_PGLITE_MODULE;
 if(!modulePath||!path.isAbsolute(modulePath))throw Error('Set KK_PGLITE_MODULE to the absolute QA-only @electric-sql/pglite package folder. No dependency is installed automatically.');
 const pkg=JSON.parse(fs.readFileSync(path.join(modulePath,'package.json'),'utf8'));
 assert.equal(pkg.name,'@electric-sql/pglite');
 assert.ok(['0.5.10','0.3.14'].includes(pkg.version),'Use an explicitly reviewed pinned QA engine version');
 let networkAttempts=0;
 const originalFetch=global.fetch,originalConnect=net.Socket.prototype.connect;
 const denyNetwork=()=>{networkAttempts++;throw Error('Embedded Inbox acceptance is strictly offline');};
 global.fetch=denyNetwork;net.Socket.prototype.connect=denyNetwork;
 const {PGlite}=require(modulePath);
 const db=new PGlite();
 const report={schema_version:'KK_INBOX_EMBEDDED_POSTGRES_ACCEPTANCE_V1',recorded_at:new Date().toISOString(),
  engine_package:pkg.name,engine_package_version:pkg.version,source_hashes:{},checks:[],
  network_requests:0,production_writes:0,provider_sends:0,
  multi_session_concurrency_verified:false,hosted_postgrest_verified:false,production_verified:false};
 const query=(sql,args=[])=>db.query(sql,args);
 const scalar=async(sql,args=[])=>(await query(sql,args)).rows[0].result;
 const reserve=(id=crypto.randomUUID(),cid=CID,digest=DIGEST,parent=null,reason='')=>scalar(
  'select public.kk_inbox_reserve_outbound($1::uuid,$2::text,$3::text,$4::uuid,$5::text) as result',[id,cid,digest,parent,reason]);
 const finish=(id,status,provider='',request='')=>scalar(
  'select public.kk_inbox_finish_outbound($1::uuid,$2::text,$3::text,$4::text) as result',[id,status,provider,request]);
 const review=(id,status='VERIFIED_SENT',cid=CID,evidence='LINE-OA:synthetic-proof')=>scalar(
  'select public.kk_inbox_review_outbound($1::text,$2::uuid,$3::text,$4::text,$5::text) as result',[cid,id,status,evidence,'Synthetic owner review']);
 const legacy=(cid=CID,body=BODY)=>scalar('select public.kk_inbox_has_legacy_outbound($1::text,$2::text) as result',[cid,body]);
 async function record(id,provider='synthetic-provider',cid=CID,overrides={}){
  const reservation=(await query('select retry_key::text from kk_private.inbox_outbound_attempts where request_id=$1::uuid',[id])).rows[0];
  return (await query('select * from public.kk_inbox_record_outbound($1::jsonb)',[JSON.stringify({
   message_id:'msg_'+crypto.createHash('sha256').update(provider).digest('hex').slice(0,24),
   conversation_id:cid,channel:'line',external_message_id:provider,external_user_id:cid===OTHER?OTHER_USER:USER,
   text:BODY,send_authorized:true,authorized_by:'owner',outbound_request_id:id,
   sent_at:'2026-10-16T07:00:00.000Z',retry_key:reservation?.retry_key||crypto.randomUUID(),provider_request_id:'synthetic-provider-request',...overrides
  })])).rows[0];
 }
 async function sent(id,provider='synthetic-provider'){
  assert.equal((await reserve(id)).allowed,true);
  assert.equal((await record(id,provider)).writes,1);
  assert.equal((await finish(id,'SENT',provider,'synthetic-provider-request')).status,'SENT');
 }
 async function reset(){
  await db.exec('reset role;truncate kk_private.inbox_outbound_attempts,kk_private.inbox_messages,kk_private.inbox_conversations,kk_private.inbox_audit restart identity cascade;');
  await query('insert into kk_private.inbox_conversations(conversation_id,channel,external_user_id) values($1,\'line\',$2),($3,\'line\',$4),($5,\'x\',\'synthetic-x-user\')',[CID,USER,OTHER,OTHER_USER,XROOM]);
  await db.exec('set role service_role');
 }
 async function check(name,fn){
  try{await reset();await fn();report.checks.push({name,status:'PASS'});}
  catch(err){report.checks.push({name,status:'FAIL',error_code:String(err.code||'ASSERTION_FAILED'),message:err.message});}
 }
 async function denied(fn,code){await assert.rejects(fn,err=>!code||err.code===code);}
 function bridge(){
  const calls=[];
  const rpc={
   kk_inbox_has_legacy_outbound:{sql:'select public.kk_inbox_has_legacy_outbound($1::text,$2::text) as result',keys:['p_conversation_id','p_body_text']},
   kk_inbox_reserve_outbound:{sql:'select public.kk_inbox_reserve_outbound($1::uuid,$2::text,$3::text,$4::uuid,$5::text) as result',keys:['p_request_id','p_conversation_id','p_body_fingerprint','p_repeat_of','p_repeat_reason']},
   kk_inbox_finish_outbound:{sql:'select public.kk_inbox_finish_outbound($1::uuid,$2::text,$3::text,$4::text) as result',keys:['p_request_id','p_status','p_provider_message_id','p_provider_request_id']},
   kk_inbox_record_outbound:{sql:'select * from public.kk_inbox_record_outbound($1::jsonb)',keys:['p_message'],table:true}
  };
  const store=createPostgrestStore({url:'https://db-fixture.invalid',serviceKey:KEY,fetchImpl:async(url,options)=>{
   assert.equal(options.headers.Authorization,'Bearer '+KEY);
   const name=new URL(url).pathname.replace('/rest/v1/rpc/',''),spec=rpc[name];
   assert.ok(spec,'Only explicitly mapped local SQL RPCs may run');calls.push(name);
   const body=JSON.parse(options.body);
   try{
    const result=await query(spec.sql,spec.keys.map(k=>k==='p_message'?JSON.stringify(body[k]):body[k]));
    return new Response(JSON.stringify(spec.table?result.rows:result.rows[0].result));
   }catch(_){return new Response(JSON.stringify({error:'Synthetic local SQL failure'}),{status:409});}
  }});
  return {store,calls};
 }
 function sender(store,behavior){
  const calls=[];
  const deps={store,serviceKey:KEY,lineToken:'SYNTHETIC_QA_TOKEN',lineMessaging:{pushText:async(message,options)=>{
   calls.push({message,retryKey:options.retryKey});
   if(behavior)return behavior(message,options,calls.length);
   return {external_message_id:'synthetic-provider-'+calls.length,provider_request_id:'synthetic-request',provider_confirmed:true,sent_at:'2026-10-16T07:00:00.000Z'};
  }}};
  return {calls,run:(overrides={})=>sendOnce({conversationId:CID,body:BODY,requestId:crypto.randomUUID(),conversation:{conversation_id:CID,channel:'line',external_user_id:USER},...overrides},deps)};
 }
 try{
  await db.waitReady;
  report.postgres_version=(await query('select version() as version')).rows[0].version;
  // The storage table is a local structural fixture, not Supabase Storage.
  await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);');
  for(const file of SOURCES){const bytes=fs.readFileSync(path.join(root,file));report.source_hashes[file]=crypto.createHash('sha256').update(bytes).digest('hex');await db.exec(bytes.toString('utf8'));}
  await check('source SQL compiles and obsolete three-argument reservation RPC is absent',async()=>{
   const rows=(await query("select pronargs from pg_proc where proname='kk_inbox_reserve_outbound'")).rows;
   assert.deepEqual(rows,[{pronargs:5}]);
  });
  await check('all Inbox RPCs deny anonymous/authenticated and allow service_role',async()=>{
   const rows=(await query("select proname,has_function_privilege('anon',oid,'EXECUTE') as anon,has_function_privilege('authenticated',oid,'EXECUTE') as authenticated,has_function_privilege('service_role',oid,'EXECUTE') as service from pg_proc where proname like 'kk_inbox_%'")).rows;
   assert.ok(rows.length>=13);for(const row of rows){assert.equal(row.anon,false,row.proname);assert.equal(row.authenticated,false,row.proname);assert.equal(row.service,true,row.proname);}
  });
  for(const role of ['anon','authenticated'])await check(role+' cannot read private rows or invoke reservation',async()=>{
   await db.exec('reset role;set role '+role);
   await denied(()=>query('select * from kk_private.inbox_conversations'),'42501');
   await denied(()=>reserve(),'42501');
   await denied(()=>scalar('select public.kk_inbox_media_metadata($1,$2) as result',[CID,'synthetic']),'42501');
  });
  await check('private Inbox tables retain RLS and audit/outbound deletion privileges are absent',async()=>{
   const rows=(await query("select relname,relrowsecurity from pg_class where relnamespace='kk_private'::regnamespace and relkind='r'")).rows;
   assert.equal(rows.length,4);for(const row of rows)assert.equal(row.relrowsecurity,true,row.relname);
   assert.equal(await scalar("select has_table_privilege('service_role','kk_private.inbox_audit','UPDATE') as result"),false);
   assert.equal(await scalar("select has_table_privilege('service_role','kk_private.inbox_outbound_attempts','DELETE') as result"),false);
  });
  await check('new reservation commits a UUID retry key without any customer text',async()=>{
   const id=crypto.randomUUID(),result=await reserve(id);assert.equal(result.allowed,true);assert.match(result.retry_key,/^[a-f0-9-]{36}$/);
   const row=(await query('select * from kk_private.inbox_outbound_attempts')).rows[0];
   assert.equal(row.request_id,id);assert.equal(row.status,'RESERVED');assert.equal(row.body_fingerprint,DIGEST);assert.ok(!JSON.stringify(row).includes(BODY));
  });
  await check('same request is blocked and cross-room/content identity reuse conflicts',async()=>{
   const id=crypto.randomUUID();await reserve(id);assert.equal((await reserve(id)).status,'ALREADY_RESERVED');
   assert.equal((await reserve(id,OTHER)).status,'REQUEST_CONFLICT');assert.equal((await reserve(id,CID,'b'.repeat(64))).status,'REQUEST_CONFLICT');
  });
  await check('different request ID with unresolved identical body cannot send',async()=>{
   await reserve();assert.equal((await reserve()).status,'UNRESOLVED_OUTBOUND_IN_WINDOW');
  });
  await check('reservation holds a transaction advisory lock until commit',async()=>{
   // Embedded PG17 reports backend PID0 but lock PID NULL. Match the exact
   // 64-bit reservation lock key, not a backend-PID assumption.
   const held=()=>scalar("with identity as (select hashtextextended($1::text,0) as h) select count(*)::int as result from pg_locks,identity where locktype='advisory' and classid::bigint=((h>>32)&4294967295) and objid::bigint=(h&4294967295) and objsubid=1 and granted",[CID+':'+DIGEST]);
   await db.exec('begin');let committed=false;
   try{
    assert.equal(await held(),0);
    await reserve();
    assert.equal(await held(),1);
    await db.exec('commit');committed=true;
    assert.equal(await held(),0);
   }finally{if(!committed)await db.exec('rollback');}
  });
  await check('missing and non-LINE conversations cannot reserve',async()=>{
   await denied(()=>reserve(crypto.randomUUID(),'conv_missing'));await denied(()=>reserve(crypto.randomUUID(),XROOM));
   assert.equal(await scalar('select count(*)::int as result from kk_private.inbox_outbound_attempts'),0);
  });
  await check('malformed and NULL identities cannot create reservations',async()=>{
   for(const args of [[null,CID,DIGEST],[crypto.randomUUID(),CID,null],[crypto.randomUUID(),CID,'not-a-hash'],[crypto.randomUUID(),null,DIGEST]])await denied(()=>reserve(...args));
   assert.equal(await scalar('select count(*)::int as result from kk_private.inbox_outbound_attempts'),0);
  });
  await check('UNCERTAIN without provider receipt remains an unresolved hold',async()=>{
   const id=crypto.randomUUID();await reserve(id);assert.equal((await finish(id,'UNCERTAIN')).status,'UNCERTAIN');
   await denied(()=>review(id));assert.equal((await reserve()).status,'UNRESOLVED_OUTBOUND_IN_WINDOW');
  });
  await check('SENT requires a nonblank persisted provider receipt',async()=>{
   const id=crypto.randomUUID();await reserve(id);await denied(()=>finish(id,'SENT'));
   assert.equal((await query('select status from kk_private.inbox_outbound_attempts')).rows[0].status,'RESERVED');
  });
  await check('a provider ID alone cannot assert SENT without exact persisted outbound message',async()=>{
   const id=crypto.randomUUID();await reserve(id);await denied(()=>finish(id,'SENT','synthetic-unpersisted-provider'));
  });
  await check('whitespace provider identity cannot become a SENT receipt',async()=>{
   const id=crypto.randomUUID();await reserve(id);await denied(()=>finish(id,'SENT','   ','   '));
  });
  await check('persisted receipt from another room cannot finalize this reservation',async()=>{
   const id=crypto.randomUUID();await reserve(id);await record(id,'synthetic-wrong-room',OTHER);
   await denied(()=>finish(id,'SENT','synthetic-wrong-room'));
  });
  await check('persisted receipt for another request cannot finalize this reservation',async()=>{
   const id=crypto.randomUUID();const r=await reserve(id);
   await record(crypto.randomUUID(),'synthetic-wrong-request',CID,{retry_key:r.retry_key});
   await denied(()=>finish(id,'SENT','synthetic-wrong-request'));
  });
  await check('persisted message with another retry key cannot finalize this reservation',async()=>{
   const id=crypto.randomUUID();await reserve(id);await record(id,'synthetic-wrong-key',CID,{retry_key:crypto.randomUUID()});
   await denied(()=>finish(id,'SENT','synthetic-wrong-key'));
  });
  await check('completion cannot invent or contradict the persisted provider request header',async()=>{
   const id=crypto.randomUUID();await reserve(id);await record(id);
   await denied(()=>finish(id,'SENT','synthetic-provider','synthetic-wrong-request-header'));
  });
  await check('missing optional provider request header remains compatible',async()=>{
   const id=crypto.randomUUID();await reserve(id);await record(id,'synthetic-no-header',CID,{provider_request_id:''});
   assert.equal((await finish(id,'SENT','synthetic-no-header')).status,'SENT');
  });
  await check('uppercase UUID payload identity still binds to the canonical reservation UUID',async()=>{
   const id=crypto.randomUUID();const r=await reserve(id);await record(id,'synthetic-uppercase',CID,{outbound_request_id:id.toUpperCase(),retry_key:r.retry_key.toUpperCase()});
   assert.equal((await finish(id,'SENT','synthetic-uppercase')).status,'SENT');
  });
  await check('genuine persisted receipt finalizes SENT and remains privately listable',async()=>{
   const id=crypto.randomUUID();await sent(id);const rows=await scalar('select public.kk_inbox_list_outbound_attempts($1,30) as result',[CID]);
   assert.equal(rows.length,1);assert.equal(rows[0].status,'SENT');assert.equal(rows[0].request_id,id);
   assert.ok(!JSON.stringify(rows).includes(DIGEST));assert.equal(rows[0].retry_key,undefined);
  });
  await check('owner verification requires exact room, durable SENT receipt and evidence',async()=>{
   const id=crypto.randomUUID();await sent(id);await denied(()=>review(id,'VERIFIED_SENT',OTHER));
   await denied(()=>review(id,'VERIFIED_SENT',CID,'x'));assert.equal((await review(id)).review_status,'VERIFIED_SENT');
  });
  await check('intentional repeat needs latest verified SENT parent and explicit reason',async()=>{
   const id=crypto.randomUUID();await sent(id);assert.equal((await reserve()).allowed,false);await review(id);
   assert.equal((await reserve(crypto.randomUUID(),CID,DIGEST,id,'short')).allowed,false);
   const repeat=await reserve(crypto.randomUUID(),CID,DIGEST,id,'Explicit synthetic owner repeat');assert.equal(repeat.allowed,true);
   assert.equal((await reserve(crypto.randomUUID(),CID,DIGEST,id,'Explicit synthetic owner repeat')).status,'UNRESOLVED_OUTBOUND_IN_WINDOW');
  });
  await check('review annotation cannot silently downgrade VERIFIED_SENT',async()=>{
   const id=crypto.randomUUID();await sent(id);await review(id);await denied(()=>review(id,'NEEDS_INVESTIGATION'));
  });
  await check('later UNCERTAIN completion cannot overwrite an owner-verified SENT receipt',async()=>{
   const id=crypto.randomUUID();await sent(id);await review(id);
   const before=(await query('select * from kk_private.inbox_outbound_attempts')).rows[0];
   await denied(()=>finish(id,'UNCERTAIN','synthetic-conflicting-provider','synthetic-conflicting-request'));
   const row=(await query('select status,review_status,provider_message_id from kk_private.inbox_outbound_attempts')).rows[0];
   assert.equal(row.status,'SENT');assert.equal(row.review_status,'VERIFIED_SENT');assert.equal(row.provider_message_id,'synthetic-provider');
   assert.deepEqual((await query('select * from kk_private.inbox_outbound_attempts')).rows[0],before);
  });
  await check('later SENT completion cannot overwrite accepted provider identity',async()=>{
   const id=crypto.randomUUID();await sent(id);await denied(()=>finish(id,'SENT','synthetic-conflicting-provider'));
  });
  await check('same-receipt completion replay is idempotent and preserves proof',async()=>{
   const id=crypto.randomUUID();await sent(id);await review(id);
   assert.equal((await finish(id,'SENT','synthetic-provider','synthetic-provider-request')).status,'SENT');
   assert.equal((await finish(id,'UNCERTAIN')).status,'SENT');
   assert.equal((await query('select provider_message_id from kk_private.inbox_outbound_attempts')).rows[0].provider_message_id,'synthetic-provider');
  });
  await check('image metadata returns provider ID only for the exact incoming image conversation',async()=>{
   const input={message_id:'msg_'+'d'.repeat(24),conversation_id:CID,channel:'line',external_message_id:'synthetic-inbound-image',external_user_id:USER,message_type:'image',line_message_id:'123456789012345',text:''};
   await query('select * from public.kk_inbox_persist_inbound($1::jsonb)',[JSON.stringify(input)]);
   const get=(cid,id)=>scalar('select public.kk_inbox_media_metadata($1,$2) as result',[cid,id]);
   assert.equal((await get(CID,input.message_id)).provider_message_id,'123456789012345');assert.equal(await get(OTHER,input.message_id),null);assert.equal(await get(CID,'msg_'+'e'.repeat(24)),null);
  });
  await check('private media bucket remains nonpublic',async()=>{
   await db.exec('reset role');assert.equal((await query("select public from storage.buckets where id='kk-inbox-media'")).rows[0].public,false);
  });
  await check('legacy history boolean is service-only, read-only and validates bounded input',async()=>{
   const metadata=(await query("select provolatile,prosecdef,proconfig from pg_proc where oid='public.kk_inbox_has_legacy_outbound(text,text)'::regprocedure")).rows[0];
   assert.equal(metadata.provolatile,'s');assert.equal(metadata.prosecdef,false);
   assert.deepEqual(metadata.proconfig,['search_path=pg_catalog, kk_private']);
   assert.equal(await legacy(),false);
   const before=await scalar('select jsonb_build_array((select count(*) from kk_private.inbox_messages),(select count(*) from kk_private.inbox_audit),(select count(*) from kk_private.inbox_outbound_attempts)) as result');
   for(const args of [[null,BODY],[CID,null],[CID,'   '],[CID,'x'.repeat(5001)],['conv_missing',BODY],[XROOM,BODY]])await denied(()=>legacy(...args));
   for(const role of ['anon','authenticated']){
    await db.exec('reset role;set role '+role);await denied(()=>legacy(),'42501');
   }
   await db.exec('reset role;set role service_role');assert.equal(await legacy(),false);
   assert.deepEqual(await scalar('select jsonb_build_array((select count(*) from kk_private.inbox_messages),(select count(*) from kk_private.inbox_audit),(select count(*) from kk_private.inbox_outbound_attempts)) as result'),before);
  });
  await check('legacy duplicate outside newest200 messages blocks before SQL reserve or provider',async()=>{
   await record(crypto.randomUUID(),'synthetic-legacy-original',CID,{sent_at:new Date(Date.now()-86400000).toISOString(),outbound_request_id:'legacy-not-a-uuid',retry_key:''});
   await query("insert into kk_private.inbox_messages(message_id,conversation_id,channel,external_message_id,external_user_id,direction,message_type,body_text,sent_at,payload) select 'synthetic_newer_'||i,$1,'line','synthetic_newer_'||i,$2,'outbound','text','Unrelated newer text',now(),'{}'::jsonb from generate_series(1,250) i",[CID,USER]);
   assert.equal(await scalar('select count(*)::int as result from kk_private.inbox_messages'),251);
   assert.equal(await legacy(),true);
   assert.equal(await legacy(OTHER),false);assert.equal(await legacy(CID,'Different new text'),false);
   const {store,calls}=bridge(),s=sender(store);const result=await s.run();
   assert.equal(result.error_code,'INBOX_LEGACY_OUTBOUND_REVIEW_REQUIRED');assert.equal(result.http_status,409);
   assert.deepEqual(calls,['kk_inbox_has_legacy_outbound']);assert.equal(s.calls.length,0);
   assert.equal(await scalar('select count(*)::int as result from kk_private.inbox_outbound_attempts'),0);
  });
  await check('legacy history excludes exact new-ledger conversation membership without UUID casts',async()=>{
   const id=crypto.randomUUID();await reserve(id);await record(id,'synthetic-ledger-receipt',CID,{outbound_request_id:id.toUpperCase()});
   assert.equal(await legacy(),false);
   await query("update kk_private.inbox_messages set payload=jsonb_set(payload,'{outbound_request_id}','\"malformed-uuid\"'::jsonb)");
   assert.equal(await legacy(),true);
  });
  await check('another conversation reservation cannot exempt a legacy body from review',async()=>{
   const id=crypto.randomUUID();await reserve(id,OTHER);await record(id,'synthetic-other-room-request',CID);
   assert.equal(await legacy(),true);
  });
  await check('legacy history matches trimmed text and ignores records outside30day sent window',async()=>{
   await record(crypto.randomUUID(),'synthetic-legacy-old',CID,{text:'  '+BODY+'  ',sent_at:new Date(Date.now()-31*86400000).toISOString(),outbound_request_id:''});
   assert.equal(await legacy(),false);
   await query("update kk_private.inbox_messages set sent_at=now()-interval '29 days'");
   assert.equal(await legacy(CID,'  '+BODY+'  '),true);
  });
  await check('server orchestration uses real SQL reserve, persisted message and completion once',async()=>{
   const {store,calls}=bridge(),s=sender(store),id=crypto.randomUUID();const first=await s.run({requestId:id});
   assert.equal(first.ok,true);assert.equal(s.calls.length,1);assert.deepEqual(calls,['kk_inbox_has_legacy_outbound','kk_inbox_reserve_outbound','kk_inbox_record_outbound','kk_inbox_finish_outbound']);
   assert.equal((await s.run({requestId:id})).ok,false);assert.equal(s.calls.length,1);
   assert.equal((await query('select status from kk_private.inbox_outbound_attempts')).rows[0].status,'SENT');
  });
  await check('20 queued same-backend send attempts have one provider invocation (not multi-session proof)',async()=>{
   const {store}=bridge(),s=sender(store);const rows=await Promise.all(Array.from({length:20},()=>s.run()));
   assert.equal(rows.filter(r=>r.ok).length,1);assert.equal(s.calls.length,1);
   assert.equal(await scalar('select count(*)::int as result from kk_private.inbox_outbound_attempts'),1);
  });
  await check('provider ambiguity remains UNCERTAIN and blocks subsequent new-click send',async()=>{
   const {store}=bridge(),s=sender(store,()=>{throw Error('Synthetic timeout')});
   assert.equal((await s.run()).error_code,'INBOX_LINE_SEND_UNCERTAIN');assert.equal((await s.run()).ok,false);assert.equal(s.calls.length,1);
   assert.equal((await query('select status from kk_private.inbox_outbound_attempts')).rows[0].status,'UNCERTAIN');
  });
  await check('post-provider persistence failure preserves receipt in UNCERTAIN and prevents replay',async()=>{
   const {store}=bridge();store.recordOutbound=async()=>{throw Error('Synthetic persistence failure')};const s=sender(store);
   assert.equal((await s.run()).error_code,'INBOX_OUTBOUND_PERSIST_UNCERTAIN');assert.equal((await s.run()).ok,false);assert.equal(s.calls.length,1);
   const row=(await query('select status,provider_message_id from kk_private.inbox_outbound_attempts')).rows[0];assert.equal(row.status,'UNCERTAIN');assert.equal(row.provider_message_id,'synthetic-provider-1');
  });
  report.pass=report.checks.filter(c=>c.status==='PASS').length;report.fail=report.checks.length-report.pass;
  report.network_attempts=networkAttempts;
  report.technical_pass=report.fail===0&&networkAttempts===0;report.release_ready=false;
  report.limitations=['Embedded PostgreSQL single session; no independent-session advisory lock contention proof','Storage table is a local schema fixture; no hosted object storage or real image bytes','Local SQL bridge replaces HTTP; no hosted PostgREST/provider acceptance','Hosted database version/configuration still requires exact release acceptance','No live migration, customer message, booking/PII/ACL or automation mutation'];
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if(!report.technical_pass)process.exitCode=1;
 }finally{await db.close();global.fetch=originalFetch;net.Socket.prototype.connect=originalConnect;}
}
main().catch(err=>{console.error('INBOX_POSTGRES_ACCEPTANCE_FAILED:',err.message);process.exitCode=1;});
