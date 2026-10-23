#!/usr/bin/env node
'use strict';

// Read-only, zero-row live check against the exact Google GViz header transport.
// Never prints or stores Google response payloads or customer/Booking row values.
// Query Language "limit 0" asks for labels only; headers=1 pins schema row.
const F=require('../server/admin-sheet-fallback.js');
const DEFAULT_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';

function urlFor(sheetId,spec){
  const url=new URL('https://docs.google.com/spreadsheets/d/'+encodeURIComponent(sheetId)+'/gviz/tq');
  url.searchParams.set('tqx','out:csv');
  url.searchParams.set('sheet',spec.sheet);
  url.searchParams.set('range',spec.range);
  url.searchParams.set('headers','1');
  url.searchParams.set('tq','select A limit 0');
  return url;
}
async function probe({sheetId,fetchImpl=fetch,keys=Object.keys(F.SPECS)}={}){
  const id=String(sheetId||'').trim();
  if(!id)throw new Error('GVIZ_HEADER_PROBE_SHEET_ID_MISSING');
  const results=await Promise.all(keys.map(async key=>{
    const spec=F.SPECS[key];
    if(!spec)throw new Error('GVIZ_HEADER_PROBE_INVALID_DATASET');
    let response;
    try{
      response=await fetchImpl(urlFor(id,spec),{signal:AbortSignal.timeout(9000),redirect:'error'});
    }catch(_){return {dataset:key,ok:false,code:'FETCH_FAILED'};}
    if(!response.ok)return {dataset:key,ok:false,code:'HTTP_'+response.status};
    let csv;
    try{csv=await response.text();}catch(_){return {dataset:key,ok:false,code:'BODY_READ_FAILED'};}
    if(/<html[\s>]/i.test(csv))return {dataset:key,ok:false,code:'UNEXPECTED_HTML'};
    // Never parse or expose customer rows. A query limit 0 must yield only a
    // single label line. Reject extra rows even if the header matches.
    const rows=F.parseCsv(csv);
    if(rows.length!==1)return {dataset:key,ok:false,code:'ZERO_ROW_CONTRACT_FAILED'};
    const first=String(rows[0]&&rows[0][0]||'').trim();
    return {dataset:key,ok:first===spec.header,code:first===spec.header?'OK':'HEADER_MISMATCH'};
  }));
  return {ok:results.every(x=>x.ok),datasets:results};
}
async function main(){
  const result=await probe({sheetId:process.env.GOOGLE_SHEET_ID||DEFAULT_SHEET_ID});
  for(const r of result.datasets)console.log(r.dataset+': '+r.code);
  if(!result.ok)process.exitCode=1;
}
if(require.main===module)main().catch(err=>{console.error('GVIZ_HEADER_PROBE_FAILED: '+String(err.code||'CHECK_FAILED'));process.exitCode=1;});
module.exports={urlFor,probe};
