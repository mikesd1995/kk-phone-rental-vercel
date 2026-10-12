'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Control=require('../server/admin-write-control-oidc.js');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const edge=read('supabase/functions/kk-admin-write-control/index.ts');
const migration=read('supabase/migrations/20261010002000_ultradeep_readonly_scan_shards.sql');
const aclLockdown=read('supabase/migrations/20261010162000_ultradeep_readonly_shard_privilege_lockdown.sql');

test('scan checkpoints stored separately from business truth with no anon access, immutable service-role rows',()=>{
 assert.match(migration,/create table if not exists public\.kk_ultra_deep_scan_shards/);
 assert.match(migration,/references public\.kk_ultra_deep_commands\(command_id\)/);
 assert.match(migration,/production_writes integer not null default 0 check\(production_writes=0\)/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on table public\.kk_ultra_deep_scan_shards from public,anon,authenticated/);
 assert.match(migration,/grant select,insert on table public\.kk_ultra_deep_scan_shards to service_role/);
 assert.doesNotMatch(migration,/grant [^;]*update[^;]*kk_ultra_deep_scan_shards to service_role/i);
 assert.match(migration,/SHARD_IMMUTABLE_CONFLICT/);
 assert.match(migration,/SHARD_COMMAND_NOT_AUTHORIZED/);
 assert.match(migration,/and commit=false/);
 assert.match(migration,/and state='RUNNING'/);
 assert.match(migration,/p_shard_end-p_shard_start>16/);
});
test('edge storage/list functions both remain behind verified production Vercel OIDC',()=>{
 const verify=edge.indexOf('await verifyVercelIdentity(token)');
 const store=edge.indexOf('if (action === "shardReceiptStore")');
 const list=edge.indexOf('if (action === "shardReceiptList")');
 assert.ok(verify>0&&store>verify&&list>verify);
 assert.match(edge,/crypto\.subtle\.digest\("SHA-256", canonicalBytes\)/);
 assert.match(edge,/SHARD_INTEGRITY_HASH_MISMATCH/);
 assert.match(edge,/SHARD_PAYLOAD_TOO_LARGE/);
 assert.match(edge,/SHARD_ENVELOPE_INVALID/);
 assert.match(edge,/business_writes:0,google_sheet_writes:0/);
 assert.doesNotMatch(edge.slice(store,list),/UPDATE_VISIBILITY|AUTO_POST_X|bookings\/|web_ready\//);
});
test('OIDC bridge stores only public search envelope and preserves idempotent receipt hashes',async()=>{
 const calls=[],receipt={version:'KK_ULTRA_DEEP_SHARD_CHECKPOINT_V1',month:'2026-10',
  phase:'SOURCE_UNIVERSE',start:0,end:1,receipt_hash:'a'.repeat(64),authoritative:false,production_writes:0};
 const fetchImpl=async(url,opts)=>{
  calls.push({url,body:JSON.parse(opts.body),authorization:opts.headers.Authorization});
  return {ok:true,status:200,json:async()=>({ok:true,authenticated:true,status:'STORED',
   phase:'SOURCE_UNIVERSE',start:0,end:1,receipt_hash:'a'.repeat(64),
   business_writes:0,google_sheet_writes:0})};
 };
 const commandId='123e4567-e89b-42d3-a456-426614174000';
 const x=await Control.shardReceiptStore(commandId,receipt,{fetchImpl,getTokenImpl:async()=>'test-v1-token'});
 assert.equal(x.ok,true);
 assert.equal(x.status,'STORED');
 assert.equal(x.receipt_hash,receipt.receipt_hash);
 assert.equal(x.business_writes,0);
 assert.equal(calls.length,1);
 assert.equal(calls[0].body.action,'shardReceiptStore');
 assert.equal(calls[0].body.command_id,commandId);
 assert.deepEqual(calls[0].body.receipt,receipt);
 assert.equal(calls[0].authorization,'Bearer test-v1-token');
});
test('reading shards via production OIDC is read only and refuses absent token',async()=>{
 let invoked=0;
 const r=await Control.shardReceiptList('123e4567-e89b-42d3-a456-426614174000','DISCOVERY',{
  getTokenImpl:async()=>'',fetchImpl:async()=>{invoked++;throw Error('should never call remote');}
 });
 assert.equal(r.ok,false);
 assert.equal(r.error_code,'VERCEL_OIDC_TOKEN_MISSING');
 assert.equal(invoked,0);
 assert.equal(r.business_writes,0);
 const good=await Control.shardReceiptList('123e4567-e89b-42d3-a456-426614174000','DISCOVERY',{
  getTokenImpl:async()=>'test-token',
  fetchImpl:async()=>({ok:true,status:200,json:async()=>({
   ok:true,authenticated:true,phase:'DISCOVERY',receipts:[{read_only:true}],read_only:true,
   business_writes:0,google_sheet_writes:0
  })})
 });
 assert.equal(good.ok,true);
 assert.deepEqual(good.receipts,[{read_only:true}]);
 assert.equal(good.read_only,true);
 assert.equal(good.business_writes,0);
});

test('production shard migration parses with balanced PostgreSQL dollar delimiters and typed zero-write guard',()=>{
 // A lone AS $ (not AS $$) is invalid PostgreSQL and blocked source release.
 assert.doesNotMatch(migration,/as \$\s*\n/i);
 assert.match(migration,/returns jsonb language plpgsql security definer set search_path='' as \$\$/);
 assert.match(migration,/end \$\$;/);
 assert.match(migration,/kk_ultra_deep_sharded_readonly_check/);
 assert.match(migration,/check\(command_kind<>'SHARDED_READ_ONLY' or \(commit=false and production_writes=0\)\)/);
 assert.match(migration,/shard_end-shard_start<=16/);
 assert.match(migration,/SHARD_PAYLOAD_INVALID/);
 assert.match(migration,/jsonb_array_length\(p_receipt_json->'records'\)<>p_shard_end-p_shard_start/);
 assert.match(migration,/revoke all on function public\.kk_ultra_deep_scan_shard_insert/);
 assert.ok((migration.match(/\$\$/g)||[]).length%2===0,'balanced $$ quotes');
});

test('Supabase default-grant remediation removes service role UPDATE DELETE TRUNCATE',()=>{
 assert.match(aclLockdown,/revoke all on table public\.kk_ultra_deep_scan_shards/);
 assert.match(aclLockdown,/from public, anon, authenticated, service_role/);
 assert.match(aclLockdown,/grant select, insert on table public\.kk_ultra_deep_scan_shards to service_role/);
 assert.doesNotMatch(aclLockdown,/grant\s+(?:all|update|delete|truncate)\b/i);
});
