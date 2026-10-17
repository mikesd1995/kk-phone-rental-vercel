'use strict';
// Isolated copy/readability QA only. Never loads the app bootstrap or live data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const out=path.resolve(process.argv[2]||'/tmp/kk-admin-diagnostic-fixture');
const source=fs.readFileSync(path.join(root,'admin/admin.js'),'utf8');
const H=require(path.join(root,'admin/snapshot-health.js'));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function take(name){
  const start=source.search(new RegExp('^  (?:async )?function '+name+'\\(','m'));
  if(start<0)throw Error('Missing source function: '+name);
  const rest=source.slice(start+1),end=rest.search(/^  (?:async )?function /m);
  if(end<0)throw Error('Missing function boundary: '+name);
  return source.slice(start,start+1+end);
}
const cssSources=[];
function css(file){
  const filename=path.join(root,'admin',file);
  const text=fs.readFileSync(filename,'utf8');
  cssSources.push({path:'admin/'+file,sha256:hash(text)});
  return text.replace(/@import url\(['"]\/admin\/([a-z0-9-]+\.css)(?:\?[^'"]*)?['"]\);/g,(_,dependency)=>css(dependency));
}
const style=css('admin.css');
const labels=new Set(['Admin UI Version','Apps Script Version','Vercel Proxy Version','Sheet ID Match','Snapshot Reader','Poster Folder','Audit/Error Logs']);
const cases={
  unknown:{admin_api_version:'admin-direct-sheet-readonly-fallback-v3.1',phase1_diagnostics:{fallback_mode:true}},
  confirmed:{admin_api_version:H.BACKEND,phase1_diagnostics:{poster_folder_id_set:true,log_sheets_ready:true}},
  missing:{admin_api_version:H.BACKEND,phase1_diagnostics:{poster_folder_id_set:false,log_sheets_ready:false}}
};
const manifest={scope:'SYNTHETIC_SCOPED_DIAGNOSTIC_COPY_ONLY',production_acceptance:false,network:'CSP default-src none; no bootstrap or external fonts',source_admin_sha256:hash(source),css_sources:cssSources,cases:[]};
fs.mkdirSync(out,{recursive:true});
for(const [name,values] of Object.entries(cases)){
  const elements=Object.fromEntries(['systemGuardGrid','systemGuardLastRun','systemGuardTable'].map(id=>['#'+id,{innerHTML:'',textContent:''}]));
  const context={KK_ADMIN_UI_VERSION:H.VERSION,EXPECTED_PROXY_VERSION:H.VERSION,EXPECTED_BACKEND_VERSION:H.BACKEND,KKSnapshotHealth:H,snapshotState:{stale:false,goodAt:'synthetic'},storefrontGuardRows:()=>[],bookingClosureGuardRows:()=>[],state:{data:{}},$:id=>elements[id]};
  vm.createContext(context);
  vm.runInContext(['esc','table','systemStatusClass','buildSnapshotGuardRows','currentSystemGuardRows','renderSystemGuard'].map(take).join('\n'),context);
  const data={...values,frontend_proxy_version:H.VERSION,spreadsheet_id:'synthetic-bound-sheet',frontend_sheet_id:'synthetic-bound-sheet'};
  context.state.systemHealth={rows:context.buildSnapshotGuardRows(data).filter(r=>labels.has(r.label)),generated_at:'2026-10-16T08:12:41Z'};
  context.renderSystemGuard();
  const html='<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Scoped diagnostic fixture: '+name+'</title><style>'+style+'</style><body><main style="margin:0;padding:16px;max-width:100%"><section id="tab-health" class="tab-panel active"><div class="card system-guard-card"><div class="card-head"><div><span class="eyebrow">LOCAL SYNTHETIC QA / '+name+'</span><h2>System Guard · ตรวจข้อความรายงาน</h2><p class="hint">ข้อมูลจำลองเพื่อเช็กข้อความเท่านั้น ไม่ใช่ผล Production</p></div></div><div id="systemGuardGrid" class="grid stats compact system-guard-grid">'+elements['#systemGuardGrid'].innerHTML+'</div><p class="hint" id="systemGuardLastRun">'+context.esc(elements['#systemGuardLastRun'].textContent)+'</p><div class="table-wrap"><table id="systemGuardTable">'+elements['#systemGuardTable'].innerHTML+'</table></div></div></section></main></body></html>';
  const filename=path.join(out,name+'.html');fs.writeFileSync(filename,html);
  manifest.cases.push({name,file:filename,sha256:hash(html),rows:context.state.systemHealth.rows});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:out,cases:manifest.cases.map(({name,file,sha256})=>({name,file,sha256})),production_acceptance:false}));
