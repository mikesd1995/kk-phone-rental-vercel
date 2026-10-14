'use strict';
// Alternate free-tier transport. An owner-deployed bound Apps Script handles
// authenticated, strictly allowlisted, bounded read-only Core ranges.
// Disabled by default. No public GViz, no Script credentials in browser.
const ALLOWED_HOST='script.google.com';
function scriptState(env=process.env){
  const raw=String(env.KK_ADMIN_SCRIPT_URL||'').trim();
  let url=null;
  try{url=new URL(raw);}catch(_){}
  const allowed=!!(url&&url.protocol==='https:'&&url.hostname===ALLOWED_HOST&&
    /^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(url.pathname)&&!url.search&&!url.hash);
  return {configured:!!(allowed&&String(env.KK_ADMIN_API_KEY||'').trim()),validUrl:allowed};
}
function err(code){const x=new Error(code);x.code=code;return x;}
async function readValues({sheetId,sheet,range,env=process.env,fetchImpl=global.fetch}={}){
  const state=scriptState(env);
  if(!state.configured)throw err('CORE_APPS_SCRIPT_NOT_CONFIGURED');
  const canonical=String(env.GOOGLE_SHEET_ID||'').trim();
  if(!canonical||String(sheetId||'').trim()!==canonical)throw err('CORE_APPS_SCRIPT_ID_MISMATCH');
  if(typeof fetchImpl!=='function')throw err('CORE_APPS_SCRIPT_FETCH_UNAVAILABLE');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetchImpl(String(env.KK_ADMIN_SCRIPT_URL).trim(),{
      method:'POST',redirect:'follow',
      headers:{'Content-Type':'text/plain; charset=utf-8'},
      body:JSON.stringify({
        action:'privateCoreRead',apiKey:String(env.KK_ADMIN_API_KEY),
        coreSheetId:canonical,sheet:String(sheet),range:String(range)
      }),signal:controller.signal
    });
    // Apps Script's ContentService may redirect to Google's content host.
    const finalUrl=String(response.url||'');
    if(finalUrl){
      let parsed;try{parsed=new URL(finalUrl)}catch(_){throw err('CORE_APPS_SCRIPT_BAD_REDIRECT')}
      if(parsed.protocol!=='https:'||
        !['script.google.com','script.googleusercontent.com'].includes(parsed.hostname))
          throw err('CORE_APPS_SCRIPT_BAD_REDIRECT');
    }
    if(!response.ok)throw err('CORE_APPS_SCRIPT_HTTP_FAILURE');
    const body=await response.json().catch(()=>null);
    const p=body&&body.data;
    if(!body||body.ok!==true||!p||String(p.spreadsheet_id||'')!==canonical||
        String(p.sheet||'')!==String(sheet)||String(p.range||'')!==String(range)||
        !Array.isArray(p.values)||p.values.length>4000||
        p.values.some(row=>!Array.isArray(row)||row.length>60)){
      throw err('CORE_APPS_SCRIPT_RESPONSE_INVALID');
    }
    return p.values;
  }catch(e){
    if(e&&e.name==='AbortError')throw err('CORE_APPS_SCRIPT_TIMEOUT');
    if(e&&String(e.code||'').startsWith('CORE_APPS_SCRIPT_'))throw e;
    throw err('CORE_APPS_SCRIPT_UNAVAILABLE');
  }finally{clearTimeout(timer)}
}
module.exports={scriptState,readValues};
