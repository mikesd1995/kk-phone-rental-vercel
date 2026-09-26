'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const R=require('../scripts/vercel-production-env-read');

test('selects exactly one unbranched Production env per required key',async()=>{
  const envs=[
    {key:'KK_ADMIN_SCRIPT_URL',value:'https://script.google.com/macros/s/abc/exec',type:'sensitive',target:['production']},
    {key:'KK_ADMIN_API_KEY',value:'secret-key',type:'sensitive',target:['production']},
    {key:'GOOGLE_SHEET_ID',value:'sheet-id',type:'sensitive',target:['production']},
    {key:'KK_ADMIN_SCRIPT_URL',value:'preview-value',type:'sensitive',target:['preview'],gitBranch:'x'}
  ];
  let requested='';
  const selected=await R.retrieveProductionEnv({
    token:'token',teamId:'team',projectId:'project',
    fetchImpl:async(url)=>{
      requested=url;
      return {ok:true,status:200,text:async()=>JSON.stringify({envs})};
    }
  });
  assert.match(requested,/decrypt=true/);
  assert.match(requested,/source=vercel-cli%3Apull/);
  assert.equal(selected.KK_ADMIN_SCRIPT_URL.value,'https://script.google.com/macros/s/abc/exec');
  assert.equal(selected.KK_ADMIN_API_KEY.value,'secret-key');
});

test('fails closed on ambiguous Production entries',()=>{
  assert.throws(()=>R.selectProductionEnv([
    {key:'KK_ADMIN_API_KEY',value:'a',target:['production']},
    {key:'KK_ADMIN_API_KEY',value:'b',target:['production']}
  ],'KK_ADMIN_API_KEY'),/COUNT_2/);
});

test('writes private dotenv file while safe summary omits values',()=>{
  const selected={
    KK_ADMIN_SCRIPT_URL:{value:'https://script.google.com/macros/s/abc/exec',type:'sensitive',target:['production']},
    KK_ADMIN_API_KEY:{value:'secret-key',type:'sensitive',target:['production']},
    GOOGLE_SHEET_ID:{value:'sheet-id',type:'sensitive',target:['production']}
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-vercel-env-'));
  const file=path.join(dir,'prod.env');
  R.writeEnvFile(file,selected);
  const stat=fs.statSync(file);
  assert.equal(stat.mode&0o777,0o600);
  assert.match(fs.readFileSync(file,'utf8'),/KK_ADMIN_SCRIPT_URL=/);
  const summary=R.safeSummary(selected);
  assert.equal(summary.KK_ADMIN_API_KEY.present,true);
  assert.doesNotMatch(JSON.stringify(summary),/secret-key|sheet-id|script\.google/);
});
