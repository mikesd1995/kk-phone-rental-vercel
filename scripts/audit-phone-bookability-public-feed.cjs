'use strict';

// Read-only acceptance audit of the canonical public Web Ready feed.
// No admin token, Google Sheets mutation, customer records or paid API calls.
const PUBLIC_FEED='https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK';

function parseCsv(value){
  const s=String(value||'').replace(/^\uFEFF/,'');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(quoted){
      if(c==='"'&&s[i+1]==='"'){cell+='"';i++;}
      else if(c==='"')quoted=false;
      else cell+=c;
    }else if(c==='"')quoted=true;
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
    else if(c!=='\r')cell+=c;
  }
  if(quoted)throw new Error('CSV_UNTERMINATED_QUOTE');
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  if(!rows.length)throw new Error('WEB_READY_FEED_EMPTY');
  const headers=rows.shift().map(h=>String(h||'').trim());
  for(const h of ['event_id','event_name','event_date_text','available_phone_count',
                   'available_lens_count','booking_status_for_web','action_for_web']){
    if(!headers.includes(h))throw new Error('WEB_READY_MISSING_COLUMN_'+h);
  }
  return rows.filter(r=>r.some(Boolean)).map(r=>
    Object.fromEntries(headers.map((h,i)=>[h,String(r[i]||'').trim()])));
}
function dateKey(value){
  const s=String(value||'').trim();
  const dmy=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if(dmy){
    let year=Number(dmy[3]);if(year>2500)year-=543;
    return year+'-'+dmy[2].padStart(2,'0')+'-'+dmy[1].padStart(2,'0');
  }
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso?s:'';
}
function phoneCount(raw){
  const s=String(raw==null?'':raw).replace(/,/g,'').trim();
  if(!/^\d+$/.test(s))return null;
  const n=Number(s);return Number.isSafeInteger(n)?n:null;
}
function inspectRows(rows,months=['2026-11','2026-12']){
  if(!Array.isArray(rows))throw new Error('ROWS_NOT_ARRAY');
  const allow=new Set(months);
  const issues=[];const stats={};
  for(const m of months)stats[m]={events:0,show:0,show_full:0,hide:0,other:0};
  const seen=new Set();
  for(const r of rows){
    const date=dateKey(r.event_date_text);
    const month=date.slice(0,7);
    if(!allow.has(month))continue;
    const action=String(r.action_for_web||'').trim().toLowerCase();
    const label=String(r.booking_status_for_web||'').trim();
    const stock=phoneCount(r.available_phone_count);
    const tags=[];
    stats[month].events++;
    if(action in stats[month])stats[month][action]++;
    else stats[month].other++;
    const identity=String(r.event_id||'').trim();
    if(!identity)tags.push('MISSING_EVENT_ID');
    else if(seen.has(identity))tags.push('DUPLICATE_EVENT_ID');
    else seen.add(identity);
    if(action!=='hide'){
      if(stock===null)tags.push('INVALID_PHONE_COUNT');
      else if(stock===0){
        if(action==='show')tags.push('SHOW_WITH_ZERO_PHONE');
        if(label==='เปิดจอง')tags.push('OPEN_BOOKING_WITH_ZERO_PHONE');
      }else if(action==='show_full'&&label==='เปิดจอง'){
        tags.push('FULL_ACTION_WITH_OPEN_LABEL');
      }
      if(action==='show'&&label==='เต็มแล้ว')tags.push('OPEN_ACTION_WITH_FULL_LABEL');
      if(action!=='show'&&action!=='show_full')tags.push('UNRECOGNIZED_PUBLIC_ACTION');
    }
    if(tags.length)issues.push({
      event_id:identity,event_name:String(r.event_name||'').trim(),
      event_date:date,available_phone_count:stock,
      available_lens_count:phoneCount(r.available_lens_count),
      action_for_web:action,booking_status_for_web:label,reasons:tags
    });
  }
  return {schema_version:'KK_PHONE_BOOKABILITY_PUBLIC_AUDIT_V1',read_only:true,
    months,stats,issues,pass:issues.length===0};
}
function inspectCsv(csv,months){
  return inspectRows(parseCsv(csv),months);
}
async function run(){
  const months=process.argv.slice(2).filter(v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v));
  const response=await fetch(PUBLIC_FEED,{
    headers:{'User-Agent':'KK-ReadOnly-Phone-Bookability-Audit/1.0'},
    signal:AbortSignal.timeout(15000)
  });
  if(!response.ok)throw new Error('WEB_READY_HTTP_'+response.status);
  const csv=await response.text();
  if(csv.length>2_000_000)throw new Error('WEB_READY_FEED_TOO_LARGE');
  const result=inspectCsv(csv,months.length?months:undefined);
  process.stdout.write(JSON.stringify({...result,source:'PUBLIC_WEB_READY',
    checked_at:new Date().toISOString()},null,2)+'\n');
  if(!result.pass)process.exitCode=1;
}
if(require.main===module)run().catch(e=>{
  process.stderr.write('PUBLIC_PHONE_AVAILABILITY_AUDIT_FAILED: '+e.message+'\n');
  process.exitCode=2;
});
module.exports={PUBLIC_FEED,parseCsv,dateKey,phoneCount,inspectRows,inspectCsv};
