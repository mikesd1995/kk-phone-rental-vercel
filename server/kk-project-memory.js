'use strict';

const VERSION='KK_PROJECT_MEMORY_V1';
const MAX_ITEMS=200;
const KINDS=new Set(['LOCKED_RULE','DECISION','IMPLEMENTATION','INCIDENT','BLOCKER','NEXT_ACTION','ACCEPTANCE','PREFERENCE']);
const SENS=/\b(?:0\d{8,9}|password|passwd|secret|token|api[_ -]?key|customer[_ -]?phone)\b/i;

function text(v){return String(v==null?'':v).trim();}
function uniq(a){return [...new Set((Array.isArray(a)?a:[]).map(text).filter(Boolean))];}
function normalize(item={}){
 const out={
  memory_id:text(item.memory_id),
  occurred_at:text(item.occurred_at),
  kind:text(item.kind).toUpperCase(),
  domain:text(item.domain).toLowerCase(),
  summary:text(item.summary),
  status:text(item.status||'ACTIVE').toUpperCase(),
  evidence_refs:uniq(item.evidence_refs),
  supersedes:uniq(item.supersedes),
  source:text(item.source||'project')
 };
 const errors=[];
 if(!/^[a-zA-Z0-9._:-]{8,160}$/.test(out.memory_id)) errors.push('MEMORY_ID_INVALID');
 if(!/^\d{4}-\d{2}-\d{2}T/.test(out.occurred_at)) errors.push('OCCURRED_AT_INVALID');
 if(!KINDS.has(out.kind)) errors.push('KIND_INVALID');
 if(!out.domain) errors.push('DOMAIN_REQUIRED');
 if(out.summary.length<8||out.summary.length>1200) errors.push('SUMMARY_INVALID');
 if(SENS.test(out.summary)) errors.push('SENSITIVE_CONTENT_REJECTED');
 if(!out.evidence_refs.length) errors.push('EVIDENCE_REQUIRED');
 return {item:out,errors};
}
function buildBootstrap(items=[],opts={}){
 const checked=items.map(normalize);
 const invalid=checked.filter(x=>x.errors.length);
 if(invalid.length) return {schema_version:VERSION,status:'BLOCKED_INVALID_MEMORY',blockers:invalid.map(x=>({memory_id:x.item.memory_id,errors:x.errors})),context:[]};
 const rows=checked.map(x=>x.item).filter(x=>x.status!=='REVOKED');
 const superseded=new Set(rows.flatMap(x=>x.supersedes));
 const active=rows.filter(x=>!superseded.has(x.memory_id)).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
 const domains=uniq(opts.domains);
 const filtered=domains.length?active.filter(x=>domains.includes(x.domain)):active;
 const limit=Math.max(1,Math.min(Number(opts.limit)||60,MAX_ITEMS));
 return {schema_version:VERSION,status:'READY',generated_from:rows.length,domains,context:filtered.slice(0,limit),rules:{business_truth_authority:false,customer_data_allowed:false,raw_chat_required:false}};
}
module.exports={VERSION,KINDS,normalize,buildBootstrap};
