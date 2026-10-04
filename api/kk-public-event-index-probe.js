'use strict';
const P=require('../server/kk-public-event-index-provider.js');
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  const provider=P.create({fetchFn:global.fetch,timeout_ms:7000});
  const rows=await provider({query:'Bangkok October 2026 concert',date_window:{start:'2026-10-01',end:'2026-10-31'}});
  const hosts=[...new Set(rows.map(r=>{try{return new URL(r.source_url).hostname}catch(_){return null}}).filter(Boolean))];
  res.statusCode=200;
  return res.end(JSON.stringify({ok:true,count:rows.length,structured_count:rows.filter(r=>/^2026-10-\d{2}$/.test(String(r.event_date||''))).length,hosts,sample:rows.slice(0,5).map(r=>({title:r.title,event_date:r.event_date,host:(()=>{try{return new URL(r.source_url).hostname}catch(_){return null}})()}))}));
 }catch(err){
  res.statusCode=500;return res.end(JSON.stringify({ok:false,error_code:String(err&&err.code||err&&err.name||'ERROR')}));
 }
};