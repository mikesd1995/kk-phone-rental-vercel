'use strict';
const {fetchPoster}=require('../server/line-poster');
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;return res.end('Method Not Allowed');}
  const eventId=String((req.query&&req.query.event_id)||'').trim();
  if(!/^EVT-[A-Z0-9-]{3,180}$/i.test(eventId)){res.statusCode=400;return res.end('Invalid event_id');}
  try{
    const out=await fetchPoster(eventId,fetch);
    res.statusCode=out.status;
    if(out.status!==200)return res.end('Poster unavailable');
    res.setHeader('Content-Type',out.type);
    res.setHeader('Content-Length',String(out.body.length));
    if(req.method==='HEAD')return res.end();
    return res.end(out.body);
  }catch(err){console.error('[line-poster]',err&&err.message?err.message:'failed');res.statusCode=502;return res.end('Poster unavailable');}
};
