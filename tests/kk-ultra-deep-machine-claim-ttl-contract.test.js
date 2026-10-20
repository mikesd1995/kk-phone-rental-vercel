'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function source(p){return fs.readFileSync(path.join(__dirname,'..',p),'utf8');}

test('deployed Supabase TABLE-returning claim can be consumed only as a single canonical row',()=>{
 const edge=source('supabase/functions/kk-admin-write-control/index.ts');
 assert.match(edge,/Array\.isArray\(result\)/);
 assert.match(edge,/result\.length === 1/);
 assert.match(edge,/command\.commit !== false/);
 assert.match(edge,/COMMAND_CLAIM_PAYLOAD_INVALID/);
});
test('draft-only DB claim migration atomically expires queued commands and disallows commits',()=>{
 const sql=source('supabase/migrations/20261020233000_ultra_deep_claim_ttl_readonly.sql');
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.kk_ultra_deep_command_claim\(p_command_id uuid\)/i);
 assert.match(sql,/RETURNS TABLE\(command_id uuid, month text, commit boolean\)/i);
 assert.match(sql,/c\.status='QUEUED'/);
 assert.match(sql,/c\.commit IS FALSE/);
 assert.match(sql,/c\.created_at >= now\(\) - interval '60 minutes'/);
 assert.match(sql,/c\.created_at <= now\(\)/);
 assert.match(sql,/RETURNING c\.command_id,c\.month,c\.commit/);
 assert.doesNotMatch(sql,/UPDATE .*SET status='FAILED'/i);
});
test('both machine command ingress paths enforce readiness before commandClaim',()=>{
 const code=source('api/kk-scanner-dispatch.js');
 const get=code.slice(code.indexOf("const readonlyCommandId=queryValue(req,'readonly_command_id')"),code.indexOf("const probeMode=queryValue(req,'probe')"));
 const post=code.slice(code.indexOf("if(text(machineInput.action)==='ultraDeepMachineRun')"),code.indexOf("const env=process.env;",code.indexOf("if(text(machineInput.action)==='ultraDeepMachineRun')")));
 for(const section of [get,post]){
  assert.ok(section.indexOf("ready_for_execution")!==-1);
  assert.ok(section.indexOf("ready_for_execution")<section.indexOf("commandClaim"));
 }
 assert.match(post,/MACHINE_COMMIT_FORBIDDEN/);
 assert.match(post,/executeWrites:false/);
});
