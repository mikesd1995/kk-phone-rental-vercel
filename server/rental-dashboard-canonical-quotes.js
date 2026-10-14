'use strict';
// Canonical future-quote adapter. Reads the private Master only with explicit owner opt-in.
// Never fetch 00_Master_Booking through anonymous GViz or expose raw PII/rows to clients.
const privateSheets=require('../api/lib/private-google-sheets.js');
const FLAG='KK_CORE_CANONICAL_QUOTE_PRIVATE_ENABLED';
function fail(code){const err=new Error(code);err.code=code;return err;}
function parseCsv(input){
  const text=String(input||'').replace(/^\uFEFF/,'');
  const rows=[];let row=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],next=text[i+1];
    if(c==='"'){
      if(quoted&&next==='"'){value+='"';i++;}else quoted=!quoted;
    }else if(!quoted&&c===','){row.push(value);value='';}
    else if(!quoted&&(c==='\n'||c==='\r')){
      if(c==='\r'&&next==='\n')i++;
      row.push(value);rows.push(row);row=[];value='';
    }else value+=c;
  }
  if(quoted)throw fail('CORE_QUOTE_CSV_INVALID');
  row.push(value);
  if(row.some(x=>String(x).trim()))rows.push(row);
  return rows.filter(r=>r.some(x=>String(x).trim()));
}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function positiveAmount(v){
  const amount=Number(String(v??'').replace(/,/g,'').trim());
  return Number.isFinite(amount)&&amount>0?amount:0;
}
function bookingQuoteMap(csv){
  const byComposite=Object.create(null),byId=Object.create(null),seenById=new Map();
  const conflicts=new Set(),rows=parseCsv(csv);
  if(!rows.length)return {byComposite,byId};
  const h=rows[0];
  // A4:X is expected to start at its own schema header, not a customer data row.
  if(h.length<24||norm(h[1])!=='bookingid'||norm(h[4])!=='eventid'||norm(h[23])!=='packageprice')
    throw fail('CORE_QUOTE_HEADER_INVALID');
  for(const r of rows.slice(1)){
    const id=String(r[1]||'').trim(),event=String(r[4]||'').trim();
    const price=positiveAmount(r[23]);
    if(!id||!price)continue;
    const key=id+'\u001f'+event;
    if(Object.prototype.hasOwnProperty.call(byComposite,key)&&byComposite[key]!==price)conflicts.add(key);
    else byComposite[key]=price;
    if(!seenById.has(id))seenById.set(id,new Set());
    seenById.get(id).add(event);
  }
  for(const key of conflicts)delete byComposite[key];
  for(const [id,events] of seenById){
    if(events.size!==1)continue;
    const key=id+'\u001f'+[...events][0];
    if(Object.prototype.hasOwnProperty.call(byComposite,key))byId[id]=byComposite[key];
  }
  return {byComposite,byId};
}
function attachQuotes(rows,quotes){
  const composite=quotes&&quotes.byComposite||{},byId=quotes&&quotes.byId||{};
  return (rows||[]).map(r=>{
    const id=String(r.booking_id||'').trim(),event=String(r.event_id||'').trim();
    const exact=composite[id+'\u001f'+event];
    const quote=event?positiveAmount(exact):positiveAmount(byId[id]);
    // In strictly reconciled private-read mode, Master column X wins over any
    // receipt/deposit amount; do not mutate source rows or the Sheet.
    return {...r,package_price:quote};
  });
}
async function readPrivateMaster(sheetId,env=process.env,reader=privateSheets.readValuesCsv){
  if(String(env[FLAG]||'').trim()!=='1')return {status:'NOT_ENABLED',csv:''};
  const explicit=String(env.GOOGLE_SHEET_ID||'').trim();
  if(!explicit||explicit!==String(sheetId||'').trim()||!privateSheets.credentialsFromEnv(env))
    throw fail('CORE_QUOTE_PRIVATE_NOT_CONFIGURED');
  try{
    const csv=await reader({sheetId:explicit,range:'00_Master_Booking!A4:X',env});
    bookingQuoteMap(csv); // Fail closed on an invalid private schema.
    return {status:'PRIVATE_VERIFIED',csv};
  }catch(_){throw fail('CORE_QUOTE_PRIVATE_READ_FAILED');}
}
module.exports={FLAG,parseCsv,bookingQuoteMap,attachQuotes,readPrivateMaster,positiveAmount};
