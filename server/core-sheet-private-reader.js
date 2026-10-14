'use strict';

// Security cutover building block. No production mutation or permission update.
// Opt-in only: KK_CORE_SHEET_REQUIRE_PRIVATE=1 after strict owner acceptance.
const privateSheets=require('../api/lib/private-google-sheets.js');
const FLAG='KK_CORE_SHEET_REQUIRE_PRIVATE';

function enabled(env=process.env){
  return ['1','true','yes','on'].includes(String(env[FLAG]||'').trim().toLowerCase());
}
function state(env=process.env){
  const id=String(env.GOOGLE_SHEET_ID||'').trim();
  const credentialsReady=!!privateSheets.credentialsFromEnv(env);
  return {
    strict:enabled(env),sheetId:id,explicitSheetId:!!id,credentialsReady,
    configured:!!(id&&credentialsReady)
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
  if(!s.credentialsReady)throw fail('CORE_PRIVATE_CREDENTIALS_NOT_CONFIGURED');
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
  return privateSheets.readValuesCsv({sheetId:sid,range:verifiedRange(sheet,range),env});
}
async function readValues({sheetId,sheet,range,env=process.env}={}){
  const sid=requireExplicitPrivateSource(sheetId,env);
  return privateSheets.readValues({sheetId:sid,range:verifiedRange(sheet,range),env});
}
module.exports={FLAG,enabled,state,requireExplicitPrivateSource,verifiedRange,readCsv,readValues};
