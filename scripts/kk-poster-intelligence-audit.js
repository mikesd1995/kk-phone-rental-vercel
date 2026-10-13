'use strict';
// Manual, zero-cost, read-only audit. Never updates a Sheet, PR, or event.
const fs=require('node:fs');
const {audit}=require('../server/kk-poster-intelligence.js');
const {objects,parseCsv,probe,pool}=require('./audit-storefront-posters.js');
const FEED='https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK';
function parseArgs(argv){
 const args={};
 for(const arg of argv){
  if(arg==='--help'){args.help=true;continue;}
  if(arg==='--probe'){args.probe=true;continue;}
  const m=arg.match(/^--(rows-file|observations-file|vision-file|as-of)=(.+)$/);
  if(!m)throw Error('UNRECOGNIZED_OPTION_'+arg);
  if(args[m[1]])throw Error('DUPLICATE_OPTION_'+m[1]);
  args[m[1]]=m[2];
 }
 return args;
}
function readArray(path,label){
 const value=JSON.parse(fs.readFileSync(path,'utf8'));
 if(!Array.isArray(value))throw Error(label+'_MUST_BE_JSON_ARRAY');
 return value;
}
async function loadRows(args,fetchImpl=global.fetch){
 if(args['rows-file'])return readArray(args['rows-file'],'ROWS');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetchImpl(FEED,{headers:{'Cache-Control':'no-cache','User-Agent':'KK-Poster-Intelligence-ReadOnly/1'},signal:controller.signal});
  if(!response.ok)throw Error('PUBLIC_FEED_HTTP_'+response.status);
  const csv=await response.text(),raw=parseCsv(csv);
  const header=raw[0]||[];
  if(!['event_id','event_name','poster_image_url','action_for_web'].every(key=>header.includes(key)))
   throw Error('UNEXPECTED_FEED_SCHEMA');
  return objects(raw);
 }finally{clearTimeout(timer);}
}
function bangkokDate(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
  timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(now).map(v=>[v.type,v.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
async function run(argv=process.argv.slice(2),deps={}){
 const args=parseArgs(argv);
 if(args.help)return {help:'node scripts/kk-poster-intelligence-audit.js [--rows-file=fixtures.json] [--as-of=2026-10-14] [--probe] [--observations-file=network-and-decoding.json] [--vision-file=ai-evidence.json]\nRead-only. Reports suspected mismatches and evidence queue; AI does not auto-approve or change data.'};
 const rows=await loadRows(args,deps.fetchImpl||global.fetch);
 const observations=args['observations-file']?readArray(args['observations-file'],'OBSERVATIONS'):[];
 if(args.probe){
  const scoped=rows.filter(r=>['show','show_full'].includes(String(r.action_for_web||'').trim().toLowerCase())&&
   (!args['as-of']||String(r.event_date_text||'').trim()));
  const sources=[...new Set(scoped.map(r=>String(r.poster_image_url||'').trim()).filter(u=>u&&(/^https:\/\//i.test(u)||u.startsWith('/'))))];
  const results=await pool(sources,u=>probe(u.startsWith('/')?'https://kk-phone-rental.vercel.app'+u:u));
  const bySource=new Map(sources.map((u,i)=>[u,results[i]]));
  for(const row of scoped){const u=String(row.poster_image_url||'').trim(),result=bySource.get(u);
   if(result)observations.push({event_id:row.event_id,poster_url:u,ok:result.ok,content_type:result.content_type,
    status:result.status,final_url:result.final_url,probe_error:result.error});
  }
 }
 const vision_reviews=args['vision-file']?readArray(args['vision-file'],'VISION'):[];
 return audit({rows,observations,vision_reviews,as_of:args['as-of']||bangkokDate(deps.now||new Date())});
}
if(require.main===module)run().then(report=>{
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(report.p0>0)process.exitCode=2;
}).catch(err=>{console.error(JSON.stringify({ok:false,error:String(err&&err.message||err)}));process.exitCode=1;});
module.exports={FEED,parseArgs,readArray,loadRows,bangkokDate,run};
