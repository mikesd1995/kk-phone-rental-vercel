'use strict';
// Owner-local only. This does not contact providers, write files, or change
// production configuration. Do not run --generate in CI/chat/remote consoles.
const crypto=require('node:crypto');
function assess(env=process.env){
  const read=String(env.KK_CORE_PRIVATE_READ_KEY||'').trim();
  const admin=String(env.KK_ADMIN_API_KEY||'').trim();
  const checks={
    reader_key_present:read.length>0,
    reader_key_length_ok:read.length>=32,
    separate_from_admin_key:read.length>=32&&admin.length>0&&read!==admin,
    usable_character_set:/^[A-Za-z0-9_-]+$/.test(read)
  };
  return {ready:Object.values(checks).every(Boolean),checks};
}
function generate(bytes=crypto.randomBytes){
  const buffer=bytes(32);
  if(!Buffer.isBuffer(buffer)||buffer.length!==32)throw Error('OWNER_KEY_ENTROPY_UNAVAILABLE');
  return buffer.toString('base64url');
}
function main(argv=process.argv.slice(2),io={env:process.env,stdin:process.stdin,stdout:process.stdout,stderr:process.stderr}){
  if(argv.length!==1 || !['--generate','--validate'].includes(argv[0])){
    io.stderr.write('Use --generate (owner local TTY only) or --validate (no secret printed).\n');
    return 2;
  }
  if(argv[0]==='--validate'){
    const r=assess(io.env);
    io.stdout.write(JSON.stringify(r)+'\n');
    return r.ready?0:2;
  }
  if(io.env.CI||io.env.GITHUB_ACTIONS||io.env.VERCEL||io.env.VERCEL_ENV||
    !io.stdin?.isTTY||!io.stdout?.isTTY){
    io.stderr.write('OWNER_LOCAL_INTERACTIVE_TERMINAL_REQUIRED; no key generated.\n');
    return 2;
  }
  const key=generate();
  const existing=String(io.env.KK_ADMIN_API_KEY||'');
  if(key===existing)throw Error('OWNER_KEY_COLLISION');
  io.stdout.write('OWNER-ONLY ONE-TIME READ KEY — NEVER COMMIT, SHARE IN CHAT, OR COPY TO BOOKING DATA:\n');
  io.stdout.write(key+'\n');
  io.stdout.write('Securely set the SAME value in bound Apps Script Script Properties and Vercel sensitive KK_CORE_PRIVATE_READ_KEY. Keep the strict mode and Script reader flag disabled until acceptance.\n');
  return 0;
}
if(require.main===module){
  try{process.exitCode=main()}catch(_){
    process.stderr.write('OWNER_KEY_GENERATION_FAILED; no secret was written.\n');
    process.exitCode=2;
  }
}
module.exports={assess,generate,main};
