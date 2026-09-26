'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const R=require('../scripts/vercel-production-env-read');

test('reads exact Production env value by id when list endpoint omits sensitive value',async()=>{
  const envs=[
    {id:'env-url',key:'KK_ADMIN_SCRIPT_URL',value:'',type:'sensitive',target:['production']},
    {id:'env-key',key:'KK_ADMIN_API_KEY',value:'',type:'sensitive',target:['production']},
    {id:'env-sheet',key:'GOOGLE_SHEET_ID',value:'',type:'sensitive',target:['production']},
    {id:'preview',key:'KK_ADMIN_SCRIPT_URL',value:'preview-value',type:'sensitive',target:['preview'],gitBranch:'x'}
  ];
  const exact={
    'env-url':{id:'env-url',key:'KK_ADMIN_SCRIPT_URL',value:'https://script.google.com/macros/s/abc/exec',type:'sensitive',decrypted:true},
    'env-key':{id:'env-key',key:'KK_ADMIN_API_KEY',value:'secret-key',type:'sensitive',decrypted:true},
    'env-sheet':{id:'env-sheet',key:'GOOGLE_SHEET_ID',value:'sheet-id',type:'sensitive',decrypted:true}
  };
  const calls=[];
  const selected=await R.retrieveProductionEnv({
    token:'token',teamId:'team',projectId:'project',
    fetchImpl:async(url)=>{
      calls.push(url);
      if(url.includes('/v10/projects/')) return {ok:true,status:200,text:async()=>JSON.stringify({envs})};
      const id=decodeURIComponent(new URL(url).pathname.split('/').pop());
      return {ok:true,status:200,text:async()=>JSON.stringify(exact[id])};
    }
  });
  assert.match(calls[0],/decrypt=true/);
  assert.match(calls[0],/source=vercel-cli%3Apull/);
  assert.ok(calls.some(x=>x.includes('/v1/projects/project/env/env-url')));
  assert.equal(selected.KK_ADMIN_SCRIPT_URL.value,'https://script.google.com/macros/s/abc/exec');
  assert.equal(selected.KK_ADMIN_API_KEY.value,'secret-key');
  assert.equal(selected.KK_ADMIN_SCRIPT_URL.decrypted,true);
});

test('fails closed on ambiguous Production entries',()=>{
  assert.throws(()=>R.selectProductionEntry([
    {id:'a',key:'KK_ADMIN_API_KEY',value:'a',target:['production']},
    {id:'b',key:'KK_ADMIN_API_KEY',value:'b',target:['production']}
  ],'KK_ADMIN_API_KEY'),/COUNT_2/);
});

test('writes private dotenv file while safe summary omits values',()=>{
  const selected={
    KK_ADMIN_SCRIPT_URL:{id:'a',value:'https://script.google.com/macros/s/abc/exec',type:'sensitive',target:['production'],decrypted:true},
    KK_ADMIN_API_KEY:{id:'b',value:'secret-key',type:'sensitive',target:['production'],decrypted:true},
    GOOGLE_SHEET_ID:{id:'c',value:'sheet-id',type:'sensitive',target:['production'],decrypted:true}
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kk-vercel-env-'));
  const file=path.join(dir,'prod.env');
  R.writeEnvFile(file,selected);
  const stat=fs.statSync(file);
  assert.equal(stat.mode&0o777,0o600);
  assert.match(fs.readFileSync(file,'utf8'),/KK_ADMIN_SCRIPT_URL=/);
  const summary=R.safeSummary(selected);
  assert.equal(summary.KK_ADMIN_API_KEY.present,true);
  assert.equal(summary.KK_ADMIN_API_KEY.decrypted,true);
  assert.doesNotMatch(JSON.stringify(summary),/secret-key|sheet-id|script\.google/);
});
