'use strict';

function installRuntimeWarningTracer(surface){
  const key='__KK_RUNTIME_WARNING_TRACER__';
  if(global[key]) return;
  global[key]=true;
  process.on('warning',warning=>{
    if(!warning || String(warning.code||'')!=='DEP0169') return;
    const stack=String(warning.stack||warning.message||'').split('\n').slice(0,12).join('\n');
    console.warn('KK_DEP0169_TRACE '+JSON.stringify({
      surface:String(surface||'unknown'),
      code:String(warning.code||''),
      name:String(warning.name||'Warning'),
      stack
    }));
  });
}
module.exports={installRuntimeWarningTracer};
