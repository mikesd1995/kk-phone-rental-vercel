'use strict';
// Audit EVIDENCE only. No Google Drive, Apps Script, LINE, Booking, Vercel,
// production, network, secret, or permission-write functionality.
// A green script test does NOT mean the reported ACL vulnerabilities are fixed.
const fs=require('node:fs');
const path=require('node:path');

const SCHEMA='kk-active-poster-acl-snapshot-v1';
const ROLES=new Set(['writer','reader','none','unreadable']);

function evaluate(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    snapshot.schema!==SCHEMA)throw new Error('SNAPSHOT_SCHEMA_INVALID');
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(snapshot.observation_date||''))
    throw new Error('SNAPSHOT_DATE_INVALID');
  if(!/^[0-9a-f]{40}$/.test(snapshot.production_sha||''))
    throw new Error('SNAPSHOT_SOURCE_SHA_INVALID');
  const scope=snapshot.scope||{};
  for(const key of ['visible_event_rows','distinct_google_drive_poster_files','non_google_drive_url_rows']){
    if(!Number.isSafeInteger(scope[key])||scope[key]<0||scope[key]>10000)
      throw new Error('SNAPSHOT_SCOPE_INVALID');
  }
  const permissions=snapshot.public_permissions;
  if(!Array.isArray(permissions)||permissions.length!==scope.distinct_google_drive_poster_files||
    permissions.length===0)throw new Error('POSTER_COVERAGE_INCOMPLETE');
  const counts={writer:0,reader:0,none:0,unreadable:0};
  for(let i=0;i<permissions.length;i++){
    const item=permissions[i];
    if(!item||typeof item!=='object'||Array.isArray(item)||
      Object.keys(item).sort().join(',')!=='anyone_permission,position'||
      item.position!==i+1||!ROLES.has(item.anyone_permission))
      throw new Error('POSTER_RECORD_INVALID');
    counts[item.anyone_permission]++;
  }
  const total=permissions.length;
  const issues=[];
  if(counts.writer)issues.push('P0_PUBLIC_WRITE_PERMISSION');
  if(counts.unreadable)issues.push('UNKNOWN_PERMISSION_UNREADABLE');
  if(counts.none)issues.push('SIGNED_OUT_IMAGE_DELIVERY_UNVERIFIED');
  // NEVER imply this is an actual remediation or authorize permission writes:
  // Review, live fresh ACL re-read, signed-out media checks, and separate owner
  // approval are ALWAYS required before production security can be closed.
  issues.push('OWNER_GATED_LIVE_RECHECK_REQUIRED');
  return Object.freeze({
    observation_date:snapshot.observation_date,
    production_sha:snapshot.production_sha,
    visible_events:scope.visible_event_rows,
    distinct_google_drive_posters:total,
    non_drive_poster_url_rows:scope.non_google_drive_url_rows,
    counts:Object.freeze(counts),
    result:counts.writer>0?'P0_BLOCKED':counts.unreadable>0?'EVIDENCE_INCOMPLETE':'REVIEW_REQUIRED',
    issues:Object.freeze(issues),
    production_acl_changed:false,
    release_authorized:false
  });
}

function run(args=process.argv.slice(2)){
  const file=path.resolve(__dirname,'../../evidence/kk-active-poster-acl-snapshot-20261107.json');
  if(args.length>1||args.some(s=>!['--report','--assert-zero-public-writer'].includes(s)))
    throw new Error('UNSUPPORTED_CLI_ARGUMENTS');
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const report=evaluate(data);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  // This option is an explicit remediation acceptance guard, NOT the normal
  // report path. A new snapshot alone cannot authorize changes or release.
  if(args.includes('--assert-zero-public-writer')&&
     (report.counts.writer>0||report.counts.unreadable>0))
    process.exitCode=2;
  return report;
}
if(require.main===module){
  try{run();}catch(e){process.stderr.write('ACL_AUDIT_EVIDENCE_INVALID '+String(e.message)+'\n');process.exitCode=3;}
}
module.exports={SCHEMA,evaluate,run};
