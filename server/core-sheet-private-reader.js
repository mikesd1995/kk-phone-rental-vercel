'use strict';

// Security cutover building block. No production mutation or permission update.
// Opt-in only: KK_CORE_SHEET_REQUIRE_PRIVATE=1 after strict owner acceptance.
const privateSheets=require('../api/lib/private-google-sheets.js');
const AppsScriptReader=require('./core-sheet-apps-script-reader.js');
const FLAG='KK_CORE_SHEET_REQUIRE_PRIVATE';

function enabled(env=process.env){
  return ['1','true','yes','on'].includes(String(env[FLAG]||'').trim().toLowerCase());
}
function state(env=process.env){
  const id=String(env.GOOGLE_SHEET_ID||'').trim();
  const credentialsReady=!!privateSheets.credentialsFromEnv(env);
  const transport=String(env.KK_CORE_PRIVATE_TRANSPORT||'none').trim();
  const appsScriptReady=transport==='apps-script'&&AppsScriptReader.scriptState(env).configured;
  const transportReady=transport==='apps-script'?appsScriptReady:transport==='service-account'?credentialsReady:false;
  return {
    strict:enabled(env),sheetId:id,explicitSheetId:!!id,credentialsReady,
    transport,transportReady,configured:!!(id&&transportReady),
    authMode:transport==='apps-script'?'apps_script_key':transport==='service-account'&&credentialsReady?'service_account':'none'
  };
}
function fail(code){
  const err=new Error(code);err.code=code;return err;
}
function requireExplicitPrivateSource(sheetId,env=process.env){
  const s=state(env);
  if(!s.strict)throw fail('CORE_PRIVATE_CUTOVER_NOT_ENABLED');
  if(!s.explicitSheetId)throw fail('CORE_PRIVATE_SHEET_ID_NOT_CONFIGURED');
  if(String(sheetId||'').trim()!==s.sheetId)throw fail('CORE_PRIVATE_SHEET_ID_MISMATCH');
  if(!s.transportReady)throw fail(s.transport==='apps-script'?'CORE_APPS_SCRIPT_NOT_CONFIGURED':'CORE_PRIVATE_CREDENTIALS_NOT_CONFIGURED');
  return s.sheetId;
}
function verifiedRange(sheet,range){
  const tab=String(sheet||'').trim();
  const a1=String(range||'').trim();
  if(!/^[A-Za-z0-9_]+$/.test(tab)||!/^[A-Z]+[1-9]\d*:[A-Z]+\d*$|^[A-Z]+[1-9]\d*:[A-Z]+$|^[A-Z]+:[A-Z]+\d*$|^[A-Z]+:[A-Z]+$/.test(a1)){
    throw fail('CORE_PRIVATE_RANGE_INVALID');
  }
  return tab+'!'+a1;
}
async function readCsv({sheetId,sheet,range,env=process.env}={}){
  const sid=requireExplicitPrivateSource(sheetId,env);
  const a1=verifiedRange(sheet,range);
  if(state(env).transport==='apps-script'){
    const values=await AppsScriptReader.readValues({sheetId:sid,sheet,range,env});
    return privateSheets.valuesToCsv(values);
  }
  return privateSheets.readValuesCsv({sheetId:sid,range:a1,env});
}
async function readValues({sheetId,sheet,range,env=process.env}={}){
  const sid=requireExplicitPrivateSource(sheetId,env);
  const a1=verifiedRange(sheet,range);
  return state(env).transport==='apps-script'
    ? AppsScriptReader.readValues({sheetId:sid,sheet,range,env})
    : privateSheets.readValues({sheetId:sid,range:a1,env});
}
module.exports={FLAG,enabled,state,requireExplicitPrivateSource,verifiedRange,readCsv,readValues};
