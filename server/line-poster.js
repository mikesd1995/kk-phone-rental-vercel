'use strict';

const PUBLIC_DATA='https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK&showPast=1';
const MAX_BYTES=10*1024*1024;
const ALLOWED_HOSTS=[
  /(^|\.)googleusercontent\.com$/i,
  /^drive\.google\.com$/i,
  /(^|\.)sinaimg\.cn$/i,
  /^kk-phone-rental\.vercel\.app$/i
];
function parseCsv(text){
  const rows=[];let row=[],cell='',q=false;const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='"'&&s[i+1]==='"'){cell+='"';i++;}else if(c==='"')q=false;else cell+=c;}else if(c==='"')q=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c!=='\r')cell+=c;}
  if(cell!==''||row.length){row.push(cell);rows.push(row);}if(!rows.length)return[];
  const h=rows[0].map(x=>String(x||'').trim());
  return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||''])));
}
function safePosterSource(raw){
  let u;try{u=new URL(String(raw||'').trim());}catch(_){return '';}
  if(u.protocol!=='https:'||!ALLOWED_HOSTS.some(re=>re.test(u.hostname)))return '';
  if(u.hostname==='drive.google.com'&&u.pathname==='/thumbnail')u.searchParams.set('sz','w768');
  return u.href;
}
async function resolveSource(eventId,fetchImpl=fetch){
  const r=await fetchImpl(PUBLIC_DATA,{headers:{'User-Agent':'KK-Line-Poster/1.0'}});
  if(!r.ok)return '';
  const id=String(eventId||'').trim();
  const row=parseCsv(await r.text()).find(x=>String(x.event_id||'').trim()===id);
  return row?safePosterSource(row.poster_image_url):'';
}
async function fetchPoster(eventId,fetchImpl=fetch){
  const source=await resolveSource(eventId,fetchImpl);
  if(!source)return {status:404};
  const r=await fetchImpl(source,{headers:{'User-Agent':'KK-Line-Poster/1.0','Accept':'image/jpeg,image/png'}});
  if(!r.ok)return {status:502};
  const type=String(r.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(type!=='image/jpeg'&&type!=='image/png')return {status:415};
  const declared=Number(r.headers.get('content-length')||0);
  if(declared>MAX_BYTES)return {status:413};
  const body=Buffer.from(await r.arrayBuffer());
  if(body.length>MAX_BYTES)return {status:413};
  return {status:200,type,body};
}
module.exports={parseCsv,safePosterSource,resolveSource,fetchPoster,MAX_BYTES};
