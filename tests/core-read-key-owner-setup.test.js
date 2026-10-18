'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Key=require('../scripts/core-read-key-owner-setup.cjs');
const source=fs.readFileSync(path.join(__dirname,'../scripts/core-read-key-owner-setup.cjs'),'utf8');
const reader='r'.repeat(43),admin='a'.repeat(43);
function IO(env={},tty=false){
 const stdout=[],stderr=[];
 return {env,stdin:{isTTY:tty},stdout:{isTTY:tty,write:x=>stdout.push(String(x))},
   stderr:{write:x=>stderr.push(String(x))},stdoutLines:stdout,stderrLines:stderr};
}
test('owner-local generator uses exactly 256 bits from cryptographic node:crypto',()=>{
 const out=Key.generate(n=>Buffer.alloc(n,0x5a));
 assert.equal(out.length,43);
 assert.match(out,/^[A-Za-z0-9_-]+$/);
 assert.match(source,/require\('node:crypto'\)/);
 assert.doesNotMatch(source,/require\('node:fs'\)|writeFileSync|localStorage|fetch\(/);
});
test('noninteractive or CI jobs cannot generate or echo any key',()=>{
 for(const env of [{},{CI:'true'},{GITHUB_ACTIONS:'true'},{VERCEL_ENV:'production'}]){
   const io=IO(env,false);
   assert.equal(Key.main(['--generate'],io),2);
   assert.equal(io.stdoutLines.join(''),'');
   assert.match(io.stderrLines.join(''),/OWNER_LOCAL_INTERACTIVE_TERMINAL_REQUIRED/);
 }
 const ci=IO({CI:'1'},true);
 assert.equal(Key.main(['--generate'],ci),2);
 assert.equal(ci.stdoutLines.join(''),'');
});
test('validation fails without reader key, with short key, with missing Admin key, or shared Admin key',()=>{
 for(const env of [
   {KK_ADMIN_API_KEY:admin},
   {KK_ADMIN_API_KEY:admin,KK_CORE_PRIVATE_READ_KEY:'short'},
   {KK_CORE_PRIVATE_READ_KEY:reader},
   {KK_ADMIN_API_KEY:reader,KK_CORE_PRIVATE_READ_KEY:reader},
   {KK_ADMIN_API_KEY:admin,KK_CORE_PRIVATE_READ_KEY:'X'.repeat(33)+'!'}
 ]){
   const result=Key.assess(env);assert.equal(result.ready,false);
 }
});
test('owner readiness rejects keys that the real Apps Script reader rejects after paste',()=>{
 const malformed=[reader+' ', ' '+reader, reader+'\\n', reader+'\n', '\t'+reader];
 for(const candidate of malformed){
   const result=Key.assess({KK_ADMIN_API_KEY:admin,KK_CORE_PRIVATE_READ_KEY:candidate});
   assert.equal(result.ready,false,'pasted whitespace must fail before cutover');
   assert.equal(result.checks.reader_key_exact_format,false);
 }
 const good=Key.assess({KK_ADMIN_API_KEY:admin,KK_CORE_PRIVATE_READ_KEY:reader});
 assert.equal(good.ready,true);
 assert.equal(good.checks.reader_key_exact_format,true);
});

test('validation checks independent safe characters but never reveals credential',()=>{
 const io=IO({KK_ADMIN_API_KEY:admin,KK_CORE_PRIVATE_READ_KEY:reader},false);
 assert.equal(Key.main(['--validate'],io),0);
 const txt=io.stdoutLines.join('');
 assert.equal(JSON.parse(txt).ready,true);
 assert.doesNotMatch(txt,/rrrrrr|aaaaaa/);
});
test('generation requires explicit --generate and an owner local TTY; no other flags accepted',()=>{
 const io=IO({KK_ADMIN_API_KEY:admin},false);
 assert.equal(Key.main([],io),2);
 assert.equal(Key.main(['--generate','--validate'],io),2);
 assert.equal(io.stdoutLines.join(''),'');
});
