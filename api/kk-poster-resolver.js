'use strict';

const ALLOWED_HOSTS=new Set([
  'www.ticketmelon.com','ticketmelon.com',
  'www.thaiticketmajor.com','thaiticketmajor.com',
  'ticket.eventpass.co','www.eventpop.me','eventpop.me',
  'hoshilive.com','www.hoshilive.com'
]);

function json(res,status,body){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(body));}
function decodeEntities(s=''){return String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'\"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function absolutize(candidate,base){if(!candidate)return '';try{return new URL(decodeEntities(candidate),base).toString();}catch(_){return '';}}
function meta(html,key){
  const attrs=String(html||'').match(/<meta\s+[^>]*>/gi)||[];
  for(const tag of attrs){
    const prop=(tag.match(/(?:property|name)=[\"']([^\"']+)[\"']/i)||[])[1]||'';
    if(prop.toLowerCase()!==String(key).toLowerCase())continue;
    const value=(tag.match(/content=[\"']([^\"']+)[\"']/i)||[])[1]||'';
    if(value)return decodeEntities(value);
  }
  return '';
}
async function fetchPage(url){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const r=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 (compatible; KKPhoneRentalPosterAudit/1.0)','accept':'text/html,application/xhtml+xml'}});
    const text=await r.text();
    return {ok:r.ok,status:r.status,url:r.url,contentType:r.headers.get('content-type')||'',text:text.slice(0,1500000)};
  }finally{clearTimeout(timer);}
}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  const raw=String(req.query&&req.query.url||'').trim();let u;
  try{u=new URL(raw);}catch(_){return json(res,400,{ok:false,error:'INVALID_URL'});}
  if(u.protocol!=='https:'||!ALLOWED_HOSTS.has(u.hostname.toLowerCase()))return json(res,400,{ok:false,error:'HOST_NOT_ALLOWED',host:u.hostname});
  try{
    const page=await fetchPage(u.toString());
    if(!page.ok)return json(res,502,{ok:false,error:'UPSTREAM_HTTP',status:page.status,final_url:page.url});
    const title=meta(page.text,'og:title')||meta(page.text,'twitter:title')||'';
    const candidates=[['og:image',meta(page.text,'og:image:secure_url')],['og:image',meta(page.text,'og:image')],['twitter:image',meta(page.text,'twitter:image:src')],['twitter:image',meta(page.text,'twitter:image')]].map(([source,value])=>({source,url:absolutize(value,page.url)})).filter(x=>x.url);
    const unique=[];const seen=new Set();for(const x of candidates){if(!seen.has(x.url)){seen.add(x.url);unique.push(x);}}
    return json(res,200,{ok:true,input_url:u.toString(),final_url:page.url,title,candidates:unique});
  }catch(error){return json(res,502,{ok:false,error:'RESOLVE_FAILED',message:String(error&&error.message||error)});}
};