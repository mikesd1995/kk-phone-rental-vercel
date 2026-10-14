'use strict';

const ORIGIN='https://kk-phone-rental.vercel.app';
const FEED=ORIGIN+'/api/kk-data?sheet=08_Web_Ready&range=A4%3AK';
const TIMEOUT_MS=8000;
const CONCURRENCY=6;
const PosterIntegrity=require('../server/kk-poster-integrity-agent.js');

function text(v){return String(v==null?'':v).trim();}
function parseCsv(input){
  const rows=[]; let row=[],val='',quoted=false;
  const s=String(input||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(c==='"'){if(quoted&&n==='"'){val+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(val);val='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&n==='\n')i++;
      row.push(val); if(row.some(x=>text(x)))rows.push(row);
      row=[];val='';
    }else val+=c;
  }
  row.push(val); if(row.some(x=>text(x)))rows.push(row);
  return rows;
}
function objects(rows){
  if(!rows.length)return [];
  const h=rows[0].map(text);
  return rows.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]||''])));
}
function eventDateKey(v){
  const s=text(v); let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?`${m[1]}-${m[2]}-${m[3]}`:'';
}
function emergencyPoster(row){
  const name=text(row.event_name).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
  const d=eventDateKey(row.event_date_text||row.event_date||row.date);
  if(d==='2026-10-08'&&name.includes('unlucky bae'))return '/assets/event-posters/unlucky-bae-final-ep-official-2026-10-08.jpg';
  if(d==='2026-10-08'&&name.includes('cir*crl')&&name.includes('anniversary'))return '/assets/event-posters/circrl-1st-anniversary-2026-10-08.jpeg';
  if(d==='2026-11-08'&&name.includes('maxkybas')&&name.includes('arcade'))return '/assets/event-posters/maxkybas-arcade-2026-11-08.jpg';
  if(d==='2026-09-30'&&name.includes('nineentertain')&&name.includes('24th'))return '/assets/event-posters/nineentertain-24th-anniversary-charity-concert-2026-09-30.jpg';
  if(d==='2026-09-30'&&(name.includes('min min')||name.includes('minmin'))&&name.includes('teeteepor'))return '/assets/event-posters/minmin-teeteepor-frozen-candy-land-2026-09-30.jpg';
  if(d==='2026-10-04'&&name.includes('bnk48')&&name.includes('cgm48')&&name.includes('fan festival'))return 'https://bnk48ota.com/wp-content/uploads/2026/09/fan-festival2026.jpeg';
  if(d==='2026-10-04'&&name.includes('aibeck')&&name.includes('bangkok'))return 'https://tm-prod-event-files-v3.ticketmelon.com/abbee918818711f1922201117567899b/poster/22ca6dd890a511f1922201117567899b.png';
  return '';
}
function driveId(url){
  const m=text(url).match(/[?&]id=([a-zA-Z0-9_-]{15,})/); return m?m[1]:'';
}
function candidates(url){
  const s=text(url); if(!s)return [];
  const id=driveId(s);
  if(id)return [
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`,
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w600`,
    `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
  ];
  return [s.startsWith('/')?ORIGIN+s:s];
}
function host(url){
  try{return new URL(url.startsWith('/')?ORIGIN+url:url).hostname.toLowerCase();}
  catch{return 'invalid';}
}
function publicImageUrl(url){
  try{
    const u=new URL(url);
    if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return false;
    const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
    if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='::1'||host==='0.0.0.0'||host.startsWith('fc')&&host.includes(':')||host.startsWith('fd')&&host.includes(':')||host.startsWith('fe80:'))return false;
    const ip=host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if(ip){
      const [a,b,c,d]=ip.slice(1).map(Number);
      if([a,b,c,d].some(n=>n>255)||a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127)return false;
    }
    return true;
  }catch{return false;}
}
function hasImageSignature(bytes,type){
  if(!bytes||!bytes.length)return false;
  const ct=text(type).split(';')[0].toLowerCase();
  const b=bytes;
  if(ct==='image/jpeg')return b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff;
  if(ct==='image/png')return b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v);
  if(ct==='image/gif')return b.length>=6&&b[0]===71&&b[1]===73&&b[2]===70&&b[3]===56&&(b[4]===55||b[4]===57)&&b[5]===97;
  if(ct==='image/webp')return b.length>=12&&b[0]===82&&b[1]===73&&b[2]===70&&b[3]===70&&b[8]===87&&b[9]===69&&b[10]===66&&b[11]===80;
  if(ct==='image/avif')return b.length>=12&&b[4]===102&&b[5]===116&&b[6]===121&&b[7]===112&&
    ([97,109,105,102].some((v,i)=>b[8+i]!==v)===false||[97,118,105,102].every((v,i)=>b[8+i]===v));
  return false;
}
async function probe(url,fetchImpl=global.fetch){
  if(!publicImageUrl(url))return {url,ok:false,status:0,content_type:'',latency_ms:0,final_url:'',error:'UNSAFE_IMAGE_URL'};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  const started=Date.now();
  let target=url;
  try{
    for(let hop=0;hop<=3;hop++){
      if(!publicImageUrl(target))return {url,ok:false,status:0,content_type:'',latency_ms:Date.now()-started,final_url:'',error:'UNSAFE_IMAGE_REDIRECT'};
      const res=await fetchImpl(target,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'Cache-Control':'no-cache','User-Agent':'KK-Storefront-Poster-Audit/1.0'}});
      if([301,302,303,307,308].includes(res.status)){
        const location=res.headers.get('location');
        if(!location)return {url,ok:false,status:res.status,content_type:'',latency_ms:Date.now()-started,final_url:target,error:'REDIRECT_WITHOUT_LOCATION'};
        const next=new URL(location,target).href;
        if(!publicImageUrl(next))return {url,ok:false,status:res.status,content_type:'',latency_ms:Date.now()-started,final_url:target,error:'UNSAFE_IMAGE_REDIRECT'};
        target=next;
        continue;
      }
      const ct=text(res.headers.get('content-type')).toLowerCase();
      const header=[];
      if(res.body){
        const reader=res.body.getReader();
        for(let i=0;i<4&&header.length<32;i++){
          const part=await reader.read();
          if(part.done)break;
          for(const b of part.value||[]){if(header.length>=32)break;header.push(b);}
        }
        try{await reader.cancel();}catch(_){}
      }
      const valid=res.ok&&hasImageSignature(header,ct);
      const error=valid?'':!res.ok?'IMAGE_HTTP_'+res.status:!ct.startsWith('image/')?'NON_IMAGE_CONTENT_TYPE':'INVALID_OR_UNSUPPORTED_IMAGE_SIGNATURE';
      return {url,ok:valid,status:res.status,content_type:ct,latency_ms:Date.now()-started,final_url:target,error};
    }
    return {url,ok:false,status:0,content_type:'',latency_ms:Date.now()-started,final_url:target,error:'IMAGE_REDIRECT_LIMIT'};
  }catch(err){
    return {url,ok:false,status:0,content_type:'',latency_ms:Date.now()-started,final_url:'',error:[text(err&&err.name),text(err&&err.message)].filter(Boolean).join(': ')||'FETCH_ERROR'};
  }finally{clearTimeout(timer);}
}

async function pool(items,worker,limit=CONCURRENCY){
  const out=new Array(items.length); let next=0;
  async function run(){while(true){const i=next++;if(i>=items.length)return;out[i]=await worker(items[i],i);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},run)); return out;
}
async function main(fetchImpl=global.fetch, options={}){
  const feedRes=await fetchImpl(FEED,{headers:{'Cache-Control':'no-cache','User-Agent':'KK-Storefront-Poster-Audit/1.0'}});
  if(!feedRes.ok)throw new Error('EVENT_FEED_HTTP_'+feedRes.status);
  const csv=parseCsv(await feedRes.text());
  if(!csv.length||!['event_id','event_name','poster_image_url','action_for_web'].every(k=>csv[0].map(text).includes(k)))
    throw new Error('POSTER_FEED_SCHEMA_INVALID');
  const allRows=objects(csv);
  if(!allRows.length)throw new Error('POSTER_FEED_EMPTY');
  const asOf=options.as_of?PosterIntegrity.dateKey(options.as_of):'';
  if(options.as_of&&!asOf)throw new Error('POSTER_AS_OF_DATE_INVALID');
  const rows=allRows.filter(r=>['show','show_full'].includes(text(r.action_for_web)))
    .filter(r=>!asOf||!PosterIntegrity.dateKey(r.event_date_text||r.event_date||r.date)||
      PosterIntegrity.dateKey(r.event_date_text||r.event_date||r.date)>=asOf);
  if(!rows.length)throw new Error('POSTER_NO_VISIBLE_EVENTS');

  const unique=[...new Set(rows.flatMap(r=>{
    const canonical=candidates(r.poster_image_url);
    const fallback=emergencyPoster(r);
    return [...canonical,...(fallback&&fallback!==text(r.poster_image_url)?candidates(fallback):[])];
  }))];
  const probed=await pool(unique,url=>probe(url,fetchImpl));
  const byUrl=new Map(probed.map(x=>[x.url,x]));

  const events=rows.map(r=>{
    const canonical=candidates(r.poster_image_url);
    const fallback=emergencyPoster(r);
    const fallbackCandidates=fallback&&fallback!==text(r.poster_image_url)?candidates(fallback):[];
    const chain=[...canonical,...fallbackCandidates.filter(u=>!canonical.includes(u))];
    const checks=chain.map(u=>byUrl.get(u));
    const firstHealthy=checks.find(x=>x&&x.ok);
    return {
      event_id:text(r.event_id),event_name:text(r.event_name),event_date:text(r.event_date_text),
      canonical:text(r.poster_image_url),canonical_host:host(text(r.poster_image_url)),
      emergency_fallback:fallback||'',candidate_count:chain.length,
      status:firstHealthy?'PASS':'FAIL',
      recovered_by_fallback:!!(firstHealthy&&canonical.length&&firstHealthy.url!==canonical[0]),
      first_healthy_url:firstHealthy?firstHealthy.url:'',
      candidates:checks
    };
  });
  // Source/image identity is independent of HTTP health. No AI network calls or
  // source-of-truth mutation are ever performed by this advisory audit.
  const integrity=PosterIntegrity.triage({
    rows,as_of:asOf,
    delivery_by_event:Object.fromEntries(events.map(e=>[e.event_id,{candidates:e.candidates}]))
  });
  const failed=events.filter(e=>e.status==='FAIL');
  const recovered=events.filter(e=>e.recovered_by_fallback);
  const hostCounts={};
  for(const e of events)hostCounts[e.canonical_host]=(hostCounts[e.canonical_host]||0)+1;
  const report={
    schema:'kk-storefront-poster-health/v1',checked_at:new Date().toISOString(),
    feed:FEED,visible_events:events.length,unique_candidate_urls:unique.length,
    pass_events:events.length-failed.length,failed_events:failed.length,recovered_by_fallback:recovered.length,
    host_counts:hostCounts,
    failed:failed.map(e=>({event_id:e.event_id,event_name:e.event_name,event_date:e.event_date,canonical:e.canonical,emergency_fallback:e.emergency_fallback,candidates:e.candidates})),
    recovered:recovered.map(e=>({event_id:e.event_id,event_name:e.event_name,event_date:e.event_date,canonical:e.canonical,first_healthy_url:e.first_healthy_url})),
    events,poster_integrity:integrity,production_writes:0,business_data_mutations:0
  };
  if(options.silent!==true){
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if(failed.length||integrity.blocked)process.exitCode=2;
  }
  return report;
}
if(require.main===module){
  const args=process.argv.slice(2);
  const flags=args.filter(a=>/^--as-of=\d{4}-\d{2}-\d{2}$/.test(a));
  if(args.length!==flags.length||flags.length>1){
    console.error(JSON.stringify({ok:false,error:'INVALID_AUDIT_ARGUMENTS'}));
    process.exitCode=1;
  }else main(global.fetch,{as_of:flags.length?flags[0].slice('--as-of='.length):undefined})
   .catch(err=>{console.error(JSON.stringify({ok:false,error:text(err&&err.message)||'AUDIT_FAILED'}));process.exitCode=1;});
}
module.exports={parseCsv,objects,eventDateKey,emergencyPoster,driveId,candidates,host,publicImageUrl,hasImageSignature,probe,pool,main};
