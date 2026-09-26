'use strict';

const fs=require('node:fs');

const REQUIRED_KEYS=['KK_ADMIN_SCRIPT_URL','KK_ADMIN_API_KEY','GOOGLE_SHEET_ID'];

function targetsOf(entry){
  return Array.isArray(entry&&entry.target)?entry.target.map(String):[String(entry&&entry.target||'')].filter(Boolean);
}

function selectProductionEntry(envs,key){
  const matches=(envs||[]).filter(e=>
    String(e&&e.key||'')===key &&
    targetsOf(e).includes('production') &&
    !String(e&&e.gitBranch||'').trim()
  );
  if(matches.length!==1){
    const err=new Error('PRODUCTION_ENV_'+key+'_COUNT_'+matches.length);
    err.safe={key,count:matches.length};
    throw err;
  }
  const e=matches[0];
  return {
    id:String(e.id||''),
    key,
    value:String(e.value==null?'':e.value),
    type:String(e.type||''),
    target:targetsOf(e)
  };
}

async function getProjectEnvById({token,teamId,projectId,id,fetchImpl}){
  if(!id) throw new Error('PRODUCTION_ENV_ID_MISSING');
  const u=new URL('https://api.vercel.com/v1/projects/'+encodeURIComponent(projectId)+'/env/'+encodeURIComponent(id));
  u.searchParams.set('teamId',teamId);
  const res=await fetchImpl(u.toString(),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  const text=await res.text();
  if(!res.ok) throw new Error('VERCEL_ENV_VALUE_HTTP_'+res.status);
  let body;
  try{body=JSON.parse(text);}catch(_){throw new Error('VERCEL_ENV_VALUE_NON_JSON');}
  return body;
}

async function resolveProductionEntry({entry,token,teamId,projectId,fetchImpl}){
  if(entry.value) return entry;
  const exact=await getProjectEnvById({token,teamId,projectId,id:entry.id,fetchImpl});
  const value=String(exact&&exact.value==null?'':exact.value);
  if(!value){
    const err=new Error('PRODUCTION_ENV_'+entry.key+'_EMPTY_AFTER_EXACT_READ');
    err.safe={key:entry.key,id_present:!!entry.id,type:String(exact&&exact.type||entry.type||''),decrypted:exact&&exact.decrypted===true};
    throw err;
  }
  return {
    id:entry.id,
    key:entry.key,
    value,
    type:String(exact&&exact.type||entry.type||''),
    target:entry.target,
    decrypted:exact&&exact.decrypted===true
  };
}

async function retrieveProductionEnv({token,teamId,projectId,fetchImpl=global.fetch}){
  if(!token) throw new Error('VERCEL_TOKEN_MISSING');
  const u=new URL('https://api.vercel.com/v10/projects/'+encodeURIComponent(projectId)+'/env');
  u.searchParams.set('teamId',teamId);
  u.searchParams.set('decrypt','true');
  u.searchParams.set('source','vercel-cli:pull');
  const res=await fetchImpl(u.toString(),{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  const text=await res.text();
  if(!res.ok) throw new Error('VERCEL_ENV_READ_HTTP_'+res.status);
  let body;
  try{body=JSON.parse(text);}catch(_){throw new Error('VERCEL_ENV_READ_NON_JSON');}
  const envs=Array.isArray(body.envs)?body.envs:Array.isArray(body.data)?body.data:[];
  const out={};
  for(const key of REQUIRED_KEYS){
    const entry=selectProductionEntry(envs,key);
    out[key]=await resolveProductionEntry({entry,token,teamId,projectId,fetchImpl});
  }
  return out;
}

function writeEnvFile(file,selected){
  const lines=REQUIRED_KEYS.map(key=>{
    const item=selected[key];
    if(!item||!item.value) throw new Error('MISSING_SELECTED_'+key);
    return key+'='+JSON.stringify(item.value);
  });
  fs.writeFileSync(file,lines.join('\n')+'\n',{mode:0o600});
}

function safeSummary(selected){
  return Object.fromEntries(REQUIRED_KEYS.map(key=>{
    const x=selected[key]||{};
    return [key,{
      present:!!x.value,
      id_present:!!x.id,
      type:String(x.type||''),
      target:x.target||[],
      decrypted:x.decrypted===true,
      value_length:String(x.value||'').length
    }];
  }));
}

async function main(){
  const out=process.argv[2];
  if(!out) throw new Error('Usage: node scripts/vercel-production-env-read.js <output-env-file>');
  const selected=await retrieveProductionEnv({
    token:process.env.VERCEL_TOKEN,
    teamId:process.env.VERCEL_ORG_ID,
    projectId:process.env.VERCEL_PROJECT_ID
  });
  writeEnvFile(out,selected);
  process.stdout.write(JSON.stringify(safeSummary(selected),null,2)+'\n');
}

if(require.main===module){
  main().catch(err=>{console.error(String(err&&err.message||err));process.exitCode=1;});
}
module.exports={REQUIRED_KEYS,targetsOf,selectProductionEntry,getProjectEnvById,resolveProductionEntry,retrieveProductionEnv,writeEnvFile,safeSummary};
