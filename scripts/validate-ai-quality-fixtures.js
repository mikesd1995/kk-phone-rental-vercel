'use strict';

const fs=require('fs');
const path=require('path');

const FILE=path.join(__dirname,'..','evals','fixtures','event-intelligence-gold.jsonl');
const SENSITIVE_KEY=/customer|phone_number|customer_phone|email|line_id|contact|address|secret|credential|authorization|cookie/i;

function visit(value,trail='root'){
  if(Array.isArray(value)){
    value.forEach((item,index)=>visit(item,`${trail}[${index}]`));
    return;
  }
  if(!value || typeof value!=='object') return;
  for(const [key,item] of Object.entries(value)){
    if(SENSITIVE_KEY.test(key)) throw new Error(`sensitive fixture key forbidden at ${trail}.${key}`);
    visit(item,`${trail}.${key}`);
  }
}

function validateFixture(row,lineNumber,seen){
  if(!row || typeof row!=='object' || Array.isArray(row)) throw new Error(`line ${lineNumber}: fixture must be object`);
  const id=String(row.fixture_id||'').trim();
  if(!/^KK-EVAL-\d{3,}$/.test(id)) throw new Error(`line ${lineNumber}: fixture_id invalid`);
  if(seen.has(id)) throw new Error(`line ${lineNumber}: duplicate fixture_id ${id}`);
  seen.add(id);
  if(!String(row.task||'').trim()) throw new Error(`line ${lineNumber}: task required`);
  if(!row.input || typeof row.input!=='object') throw new Error(`line ${lineNumber}: input required`);
  if(!row.expected || typeof row.expected!=='object') throw new Error(`line ${lineNumber}: expected required`);
  if(row.expected.authoritative!==false) throw new Error(`line ${lineNumber}: authoritative must be false`);
  if(row.expected.verifier_required!==true) throw new Error(`line ${lineNumber}: verifier_required must be true`);
  if(row.expected.production_writes!==0) throw new Error(`line ${lineNumber}: production_writes must be 0`);
  if(row.expected.final_truth_mutation!==undefined && row.expected.final_truth_mutation!==false){
    throw new Error(`line ${lineNumber}: final_truth_mutation must be false when present`);
  }
  if(row.expected.notification_sends!==undefined && row.expected.notification_sends!==0){
    throw new Error(`line ${lineNumber}: notification_sends must be 0 when present`);
  }
  visit(row);
}

function main(){
  const raw=fs.readFileSync(FILE,'utf8');
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length<5) throw new Error('at least 5 gold fixtures are required');
  const seen=new Set();
  lines.forEach((line,index)=>{
    let row;
    try{ row=JSON.parse(line); }
    catch(err){ throw new Error(`line ${index+1}: invalid JSON: ${err.message}`); }
    validateFixture(row,index+1,seen);
  });
  process.stdout.write(JSON.stringify({
    ok:true,
    fixture_count:lines.length,
    authority:'ADVISORY_ONLY',
    production_writes:0,
    file:path.relative(process.cwd(),FILE)
  })+'\n');
}

if(require.main===module) main();

module.exports={validateFixture,visit};
