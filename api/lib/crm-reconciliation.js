'use strict';

const crypto=require('crypto');

function normalizeCell(value){
  return String(value==null?'':value).replace(/\r\n/g,'\n').trim();
}

function canonicalRows(values){
  const out=[];
  for(const sourceRow of (values||[])){
    const row=(sourceRow||[]).map(normalizeCell);
    while(row.length && row[row.length-1]==='') row.pop();
    if(row.some(v=>v!=='')) out.push(row);
  }
  return out;
}

function digest(value){
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function snapshot(values,{requireData=false}={}){
  const rows=canonicalRows(values);
  const header=rows[0]||[];
  const data=rows.slice(1);
  if(!rows.length){
    return {valid:!requireData,code:requireData?'CRM_RECON_REQUIRED_EMPTY':'CRM_RECON_EMPTY_OK',row_count:0,header_hash:'',data_hash:'',full_hash:''};
  }
  if(requireData && data.length===0){
    return {valid:false,code:'CRM_RECON_REQUIRED_EMPTY',row_count:0,header_hash:digest(header),data_hash:digest([]),full_hash:digest(rows)};
  }
  return {
    valid:true,
    code:'CRM_RECON_SNAPSHOT_OK',
    row_count:data.length,
    header_hash:digest(header),
    data_hash:digest(data),
    full_hash:digest(rows)
  };
}

function compare(coreValues,crmValues,{requireData=true}={}){
  const core=snapshot(coreValues,{requireData});
  const crm=snapshot(crmValues,{requireData});
  const base={ok:false,code:'',core_row_count:core.row_count,crm_row_count:crm.row_count,core_hash:core.full_hash.slice(0,16),crm_hash:crm.full_hash.slice(0,16)};
  if(!core.valid || !crm.valid) return Object.assign(base,{code:'CRM_RECON_REQUIRED_EMPTY'});
  if(core.row_count!==crm.row_count) return Object.assign(base,{code:'CRM_RECON_COUNT_MISMATCH'});
  if(core.header_hash!==crm.header_hash) return Object.assign(base,{code:'CRM_RECON_HEADER_MISMATCH'});
  if(core.data_hash!==crm.data_hash) return Object.assign(base,{code:'CRM_RECON_HASH_MISMATCH'});
  return Object.assign(base,{ok:true,code:'CRM_RECON_OK'});
}

function parseCsv(text){
  const rows=[]; let row=[],value='',quoted=false;
  const s=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++){
    const c=s[i],n=s[i+1];
    if(c==='"'){
      if(quoted&&n==='"'){value+='"';i++;}else quoted=!quoted;
    }else if(c===','&&!quoted){row.push(value);value='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&n==='\n')i++;
      row.push(value); rows.push(row); row=[]; value='';
    }else value+=c;
  }
  row.push(value); rows.push(row);
  return rows.filter(r=>r.some(v=>normalizeCell(v)!==''));
}

async function fetchPublicValues({sheetId,sheet,range,fetchImpl=global.fetch,timeoutMs=12000}={}){
  if(typeof fetchImpl!=='function') throw Object.assign(new Error('fetch is not available'),{code:'CORE_RECON_FETCH_UNAVAILABLE'});
  const params=new URLSearchParams({tqx:'out:csv',sheet,range,t:String(Date.now())});
  const url=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(String(sheetId||''))}/gviz/tq?${params.toString()}`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetchImpl(url,{signal:controller.signal});
    const text=await res.text();
    if(!res.ok || /<!doctype html|<html/i.test(text)){
      throw Object.assign(new Error('Core reconciliation read failed'),{code:'CORE_RECON_READ_FAILED',httpStatus:res.status});
    }
    return parseCsv(text);
  }catch(err){
    if(err&&err.name==='AbortError') throw Object.assign(new Error('Core reconciliation read timed out'),{code:'CORE_RECON_TIMEOUT'});
    throw err;
  }finally{
    clearTimeout(timer);
  }
}

module.exports={normalizeCell,canonicalRows,snapshot,compare,parseCsv,fetchPublicValues};
