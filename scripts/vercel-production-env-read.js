'use strict';

const fs=require('node:fs');

const REQUIRED_KEYS=['KK_ADMIN_SCRIPT_URL','KK_ADMIN_API_KEY','GOOGLE_SHEET_ID'];

function targetsOf(entry){
  return Array.isArray(entry&&entry.target)?entry.target.map(String):[String(entry&&entry.target||'')].filter(Boolean);
}

function selectProductionEnv(envs,key){
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
  const value=String(e.value==null?'':e.value);
  if(!value){
    const err=new Error('PRODUCTION_ENV_'+key+'_EMPTY');
    err.safe={key,count:1,type:String(e.type||''),value_length:0};
    throw err;
  }
  return {key,value,type:String(e.type||''),target:targetsOf(e)};
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
  const selected=REQUIRED_KEYS.map(key=>selectProductionEnv(envs,key));
  return Object.fromEntries(selected.map(x=>[x.key,x]));
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
    return [key,{present:!!x.value,type:String(x.type||''),target:x.target||[],value_length:String(x.value||'').length}];
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
module.exports={REQUIRED_KEYS,targetsOf,selectProductionEnv,retrieveProductionEnv,writeEnvFile,safeSummary};
