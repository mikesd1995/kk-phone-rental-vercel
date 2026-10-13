'use strict';
// Manual, zero-cost, read-only audit. Never updates a Sheet, PR, or event.
const fs=require('node:fs');
const {audit}=require('../server/kk-poster-intelligence.js');
const {objects,parseCsv}=require('./audit-storefront-posters.js');
const FEED='https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK';
function parseArgs(argv){
 const args={};
 for(const arg of argv){
  if(arg==='--help'){args.help=true;continue;}
  const m=arg.match(/^--(rows-file|observations-file|vision-file)=(.+)$/);
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
async function run(argv=process.argv.slice(2),deps={}){
 const args=parseArgs(argv);
 if(args.help)return {help:'node scripts/kk-poster-intelligence-audit.js [--rows-file=fixtures.json] [--observations-file=network-and-decoding.json] [--vision-file=ai-evidence.json]\nRead-only. Reports suspected mismatches and evidence queue; AI does not auto-approve or change data.'};
 const rows=await loadRows(args,deps.fetchImpl||global.fetch);
 const observations=args['observations-file']?readArray(args['observations-file'],'OBSERVATIONS'):[];
 const vision_reviews=args['vision-file']?readArray(args['vision-file'],'VISION'):[];
 return audit({rows,observations,vision_reviews});
}
if(require.main===module)run().then(report=>{
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(report.p0>0)process.exitCode=2;
}).catch(err=>{console.error(JSON.stringify({ok:false,error:String(err&&err.message||err)}));process.exitCode=1;});
module.exports={FEED,parseArgs,readArray,loadRows,run};
