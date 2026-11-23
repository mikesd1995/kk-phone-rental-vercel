'use strict';
const TestTarget=require('./kk-line-booking-test-target');

const PUBLIC_DATA='https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK&showPast=1';
const MAX_BYTES=10*1024*1024;
const ALLOWED_HOSTS=[
  /(^|\.)googleusercontent\.com$/i,
  /^drive\.google\.com$/i,
  /^kk-phone-rental\.vercel\.app$/i
];
function parseCsv(text){
  const rows=[];let row=[],cell='',q=false;const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\r')cell+=c;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);}if(!rows.length)return[];
  const h=rows[0].map(x=>String(x||'').trim());
  return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||''])));
}
function safePosterSource(raw,env={}){
  const target=TestTarget.configuration(env);
  if(target.enabled)return TestTarget.posterSource(raw,target);
  const value=String(raw||'').trim();
  let u;try{u=new URL(value,'https://kk-phone-rental.vercel.app');}catch(_){return '';}
  if(value.startsWith('/')&&!value.startsWith('/assets/event-posters/'))return '';
  if(u.protocol!=='https:'||!ALLOWED_HOSTS.some(re=>re.test(u.hostname)))return '';
  if(u.hostname==='drive.google.com'&&u.pathname==='/thumbnail')u.searchParams.set('sz','w768');
  return u.href;
}
async function resolveSource(eventId,fetchImpl=fetch,env={}){
  const target=TestTarget.configuration(env);TestTarget.assertNow(target);
  fetchImpl=TestTarget.guardFetch(fetchImpl,target);
  const id=String(eventId||'').trim();
  if(!TestTarget.isCanonicalAllowed({event_id:id},target))return '';
  const url=target.enabled?target.origin+'/api/kk-data?sheet=08_Web_Ready&range=A4%3AK&showPast=1':PUBLIC_DATA;
  const r=await fetchImpl(url,TestTarget.readOptions({headers:{'User-Agent':'KK-Line-Poster/1.0'}},target));
  if(!r.ok||!TestTarget.validReadResponse(r,target))return '';
  const rows=parseCsv(await r.text()).filter(x=>String(x.event_id||'').trim()===id);
  if(target.enabled&&rows.length!==1)return '';
  return rows[0]?safePosterSource(rows[0].poster_image_url,env):'';
}
async function fetchPoster(eventId,fetchImpl=fetch,env={}){
  const target=TestTarget.configuration(env);
  fetchImpl=TestTarget.guardFetch(fetchImpl,target);
  const source=await resolveSource(eventId,fetchImpl,env);
  if(!source)return {status:404};
  const r=await fetchImpl(source,TestTarget.readOptions({headers:{'User-Agent':'KK-Line-Poster/1.0','Accept':'image/jpeg,image/png'}},target));
  if(!r.ok||!TestTarget.validReadResponse(r,target))return {status:502};
  const type=String(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(type!=='image/jpeg'&&type!=='image/png')return {status:415};
  const declared=Number(r.headers.get('content-length')||0);
  if(declared>MAX_BYTES)return {status:413};
  const body=Buffer.from(await r.arrayBuffer());
  if(body.length>MAX_BYTES)return {status:413};
  return {status:200,type,body};
}
module.exports={parseCsv,safePosterSource,resolveSource,fetchPoster,MAX_BYTES};
