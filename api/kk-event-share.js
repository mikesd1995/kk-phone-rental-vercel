'use strict';

const SITE_URL='https://kk-phone-rental.vercel.app';
const FEED_URL=SITE_URL+'/api/kk-data?sheet=08_Web_Ready&range=A4%3AK';

function escapeHtml(value){
  return String(value==null?'':value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function parseCsv(text){
  const rows=[]; let row=[]; let cell=''; let quoted=false;
  const input=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(quoted){
      if(ch==='"' && input[i+1]==='"'){ cell+='"'; i++; }
      else if(ch==='"') quoted=false;
      else cell+=ch;
    }else if(ch==='"') quoted=true;
    else if(ch===','){ row.push(cell); cell=''; }
    else if(ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
    else if(ch!=='\r') cell+=ch;
  }
  if(cell!==''||row.length){ row.push(cell); rows.push(row); }
  return rows;
}

function rowsToObjects(rows){
  if(!Array.isArray(rows)||!rows.length)return [];
  const h=rows[0].map(v=>String(v||'').trim());
  return rows.slice(1).filter(r=>r.some(v=>String(v||'').trim()!=='')).map(r=>{
    const o={}; h.forEach((k,i)=>{o[k]=r[i]??'';}); return o;
  });
}

function safeEventId(value){
  const id=String(value||'').trim();
  return /^EVT-[A-Za-z0-9_-]{6,160}$/.test(id)?id:'';
}

function eventDescription(event){
  const bits=[
    event&&event.event_name,
    event&&event.event_date_text ? 'วันที่ '+event.event_date_text : '',
    event&&event.venue ? 'ที่ '+event.venue : '',
    'ดูรายละเอียดและจองผ่าน LINE OA กับ KK Phone Rental'
  ].filter(Boolean);
  return bits.join(' · ').slice(0,280);
}

async function loadEvent(eventId,fetchImpl=fetch){
  const res=await fetchImpl(FEED_URL+'&t='+Date.now(),{headers:{'User-Agent':'KK-Phone-Rental-Event-Share/1.0'}});
  if(!res.ok) throw new Error('Public event feed unavailable: '+res.status);
  const rows=rowsToObjects(parseCsv(await res.text()));
  return rows.find(r=>String(r.event_id||'').trim()===eventId && String(r.action_for_web||'').trim().toLowerCase()!=='hide')||null;
}

function renderPage(eventId,event){
  const shareUrl=SITE_URL+'/event/'+encodeURIComponent(eventId);
  const target=SITE_URL+'/?event='+encodeURIComponent(eventId);
  const title=event&&event.event_name ? event.event_name+' | KK Phone Rental' : 'KK Phone Rental';
  const description=event?eventDescription(event):'เช่ามือถือสำหรับคอนเสิร์ต แฟนมีท และอีเวนต์ ดูคิวว่างและจองผ่าน LINE OA';
  const image=(event&&String(event.poster_image_url||'').trim()) || SITE_URL+'/assets/kk-brand-hero-final-20260920.png';
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,follow">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(target)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="KK Phone Rental">
<meta property="og:locale" content="th_TH">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(shareUrl)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml((event&&event.event_name)||'KK Phone Rental event')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
<p>กำลังเปิดรายละเอียดงาน… <a href="${escapeHtml(target)}">เปิด KK Phone Rental</a></p>
</body>
</html>`;
}

module.exports=async function handler(req,res){
  if(req.method!=='GET'){
    res.statusCode=405;
    res.setHeader('Allow','GET');
    return res.end('Method Not Allowed');
  }
  const raw=Array.isArray(req.query&&req.query.event)?'':(req.query&&req.query.event);
  const eventId=safeEventId(raw);
  if(!eventId){
    res.statusCode=302;
    res.setHeader('Location',SITE_URL+'/');
    return res.end();
  }
  let event=null;
  try{ event=await loadEvent(eventId); }catch(_){ event=null; }
  res.statusCode=200;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Robots-Tag','noindex, follow');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(renderPage(eventId,event));
};

module.exports._test={escapeHtml,parseCsv,rowsToObjects,safeEventId,eventDescription,loadEvent,renderPage};
