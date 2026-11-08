#!/usr/bin/env node
'use strict';
// Scoped registered Agent Gateway gate. No network, production data or business writes.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Gateway=require('../server/kk-agent-gateway.js');
const recordPath=path.resolve(process.env.ADMIN_UX_EVIDENCE_PATH||'config/kk-admin-ops-ux-evidence.json');
const folder=path.resolve(process.env.ADMIN_UX_OUTPUT_DIR||'artifacts/admin-ops-ux');
const sourceSha=String(process.env.GITHUB_SHA||process.env.ADMIN_UX_SOURCE_SHA||'').trim();
const evidence=JSON.parse(fs.readFileSync(recordPath,'utf8'));
const packets=evidence.packets;
if(evidence.source_sha256){
 for(const [file,sha] of Object.entries(evidence.source_sha256)){
   if(!/^admin\/operations-dashboard\.(html|css|js)$/.test(file)||!/^[a-f0-9]{64}$/.test(sha))throw Error('INVALID_SOURCE_EVIDENCE_PATH');
   const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
   if(actual!==sha)throw Error('VISUAL_EVIDENCE_SOURCE_HASH_MISMATCH_'+file);
 }
}
if(!/^[a-f0-9]{40}$/.test(sourceSha)||!Array.isArray(packets)||packets.length<4)throw Error('INVALID_EXACT_SOURCE_OR_VIEWPORT_EVIDENCE');
fs.mkdirSync(folder,{recursive:true});
const writeJson=(f,v)=>{const bytes=JSON.stringify(v,null,2)+'\n';fs.writeFileSync(f,bytes);if(fs.readFileSync(f,'utf8')!==bytes)throw Error('EVIDENCE_READBACK_MISMATCH');return crypto.createHash('sha256').update(bytes).digest('hex')};
async function invoke(kind,packet){
 const width=packet.viewport.width;
 const result=await Gateway.executeAgentRequest({task_type:kind,input:packet,correlation_id:'admin-ops-'+sourceSha.slice(0,16)+'-'+width+'-'+kind},{
   env:{},
   ledgerFn:async rec=>{
      const r={...rec,source_commit_sha:sourceSha,scope:'LOCAL_ARTIFACT',input_hash:crypto.createHash('sha256').update(JSON.stringify(packet)).digest('hex')};
      const f=path.join(folder,`${kind}-${width}-invocation.json`);
      const sha256=writeJson(f,r);
      return {ok:true,persistent:true,readback_verified:true,mode:'LOCAL_ARTIFACT',source_commit_sha:sourceSha,invocation_id:r.invocation_id,sha256};
   }
 });
 const artifact=path.join(folder,`${kind}-${width}-result.json`);writeJson(artifact,result);
 if(result.status!=='RECORDED'||!result.ledger?.readback_verified||!result.invocation_check?.pass)throw Error(kind+'_'+width+'_INVOCATION_BLOCKED_'+result.status);
 const evidence=result.result;
 const pass=kind==='storefront_visual_qa' ? evidence.pass===true : evidence.finding_counts?.P0===0&&evidence.finding_counts?.P1===0;
 return {kind,width,status:evidence.status,pass,P0:evidence.review?.finding_counts?.P0??evidence.finding_counts?.P0,P1:evidence.review?.finding_counts?.P1??evidence.finding_counts?.P1,invocation_id:result.invocation.invocation_id};
}
(async()=>{
 const decisions=[];
 for(const packet of packets){
  decisions.push(await invoke('storefront_ux_review',packet));
  decisions.push(await invoke('storefront_visual_qa',packet));
 }
 const passed=decisions.every(d=>d.pass);
 writeJson(path.join(folder,'summary.json'),{source_sha:sourceSha,passed,decisions,production_writes:0,auto_merge:false,auto_deploy:false});
 console.log(JSON.stringify({source_sha:sourceSha,passed,decisions},null,2));
 if(!passed)process.exitCode=1;
})().catch(err=>{console.error('ADMIN_GATE_ERROR:'+String(err.code||err.message||err));process.exitCode=2});
