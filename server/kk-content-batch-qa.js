'use strict';

const Qa=require('./kk-content-qa-gate.js');

const VERSION='KK_CONTENT_BATCH_QA_V1';
const HOOK_SIMILARITY_THRESHOLD=0.58;
const MAX_GENERIC_ARCHETYPE_REPEATS=2;
const SAFETY=Object.freeze({
  authority:'READ_ONLY_BATCH_VALIDATOR',
  production_writes:0,
  publishes:0,
  human_approval_required:true
});

function text(v){return String(v===undefined||v===null?'':v).trim();}
function uniq(values){return [...new Set((Array.isArray(values)?values:[]).filter(Boolean))];}
function normalize(value){
  return text(value)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g,' ')
    .replace(/#[\p{L}\p{M}\p{N}_]+/gu,' ')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu,' ')
    .replace(/\d[\d.,:\/\-–—]*\d*/g,' ')
    .replace(/[|,./\\\-–—:;()[\]{}'"“”‘’!?*_+=<>]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function knownAnchors(input={}){
  const raw=[
    input.event,
    input.artist,
    input.venue,
    input.official_event_hashtag,
    ...(Array.isArray(input.event_dna)?input.event_dna:[]),
    ...(Array.isArray(input.creative_anchors)?input.creative_anchors:[])
  ];
  return uniq(raw.map(text)).sort((a,b)=>b.length-a.length);
}

function escapeRegex(value){
  return text(value).replace(/[.*+?^$|()[\]{}\\]/g,'\\$&');
}

function stripKnownAnchors(value,input={}){
  let out=text(value);
  for(const anchor of knownAnchors(input)){
    if(anchor.length<2) continue;
    out=out.replace(new RegExp(escapeRegex(anchor),'giu'),' <event> ');
  }
  return out;
}

function hookLines(post,input={}){
  const price=text(input.price_display);
  const dates=Qa.dateTokens(input);
  const venues=Qa.venueTokens(input);
  const lines=text(post).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return lines.filter(line=>{
    if(line===Qa.BRAND_LINE)return false;
    if(line.includes('kk-phone-rental.vercel.app'))return false;
    if(/^#[\p{L}\p{M}\p{N}_]+(?:\s+#[\p{L}\p{M}\p{N}_]+)*$/u.test(line))return false;
    if(/^(?:[\p{Extended_Pictographic}\uFE0F]\s*)*(?:งาน\s*)?#[\p{L}\p{M}\p{N}_]+$/u.test(line))return false;
    if(/^(?:🔥|🎤|🗓️?|📍|📱|☁️|🎁|💙|👉|⚡|📸|🚨)\s*/u.test(line)){
      if(/(?:ฟรีประกัน|รับ-คืน|Google Drive|ลูกค้าใหม่|จองคิว|เช็กคิว|vivo X300|เหลือ.*เครื่อง|คิวร้าน|ร้านยัง)/iu.test(line))return false;
      if(/^(?:🗓️?|📍|🎤)/u.test(line))return false;
    }
    if(price&&Qa.occurrences(line,price)>0)return false;
    if(dates.some(d=>d&&Qa.occurrences(line,d)>0))return false;
    if(venues.some(v=>v&&Qa.occurrences(line,v)>0))return false;
    if(/^(?:งาน\s*)?#[\p{L}\p{M}\p{N}_]+$/u.test(line))return false;
    return true;
  }).slice(0,2);
}

function hookText(post,input={}){
  return hookLines(post,input).join(' ');
}

function hookSkeleton(post,input={}){
  return normalize(stripKnownAnchors(hookText(post,input),input))
    .replace(/\b(?:concert|fancon|showcase|fan meeting|world tour|arena|live)\b/giu,' <format> ')
    .replace(/\s+/g,' ')
    .trim();
}

function archetypes(post,input={}){
  const h=hookText(post,input);
  const keys=[];
  if(/(?:วันนี้(?:แล้ว)?|พรุ่งนี้|อีกไม่กี่วัน|ใกล้แล้ว|กำลัง(?:จะ)?มา|นับถอยหลัง)/iu.test(h))keys.push('TIMING_COUNTDOWN');
  if(/(?:ใคร.{0,20}มีบัตร|คนไหนมีบัตร|มีบัตรอยู่)/iu.test(h))keys.push('TICKET_HOLDER');
  if(/(?:เตรียม|ล็อก|จอง).{0,18}(?:เครื่อง|มือถือ|คิว|lens|เลนส์)/iu.test(h))keys.push('PREPARE_DEVICE');
  if(/(?:เก็บ|ถ่าย).{0,25}(?:โมเมนต์|ช็อต|เวที|เมน|ศิลปิน|ภาพ)/iu.test(h))keys.push('CAPTURE_MOMENT');
  if(/(?:เหลือ(?:เพียง)?|คิวสุดท้าย).{0,16}เครื่อง/iu.test(h))keys.push('SCARCITY');
  if(/(?:ทั้ง.{0,20}ทั้ง|งานเดียว.{0,25}(?:รวม|ได้))/iu.test(h))keys.push('ENUMERATION');
  return uniq(keys);
}

function validateItemContext(item={},index=0){
  const errors=[];
  const input=item.input&&typeof item.input==='object'?item.input:{};
  if(input.recent_context_checked!==true)errors.push('ITEM_'+(index+1)+':RECENT_CONTEXT_NOT_CHECKED');
  const dna=uniq([
    ...(Array.isArray(input.event_dna)?input.event_dna:[]),
    ...(Array.isArray(input.creative_anchors)?input.creative_anchors:[])
  ].map(text));
  if(dna.length<2)errors.push('ITEM_'+(index+1)+':EVENT_DNA_REQUIRES_2_VERIFIED_ANCHORS');
  if(!text(item.post))errors.push('ITEM_'+(index+1)+':FINAL_POST_MISSING');
  return {errors,event_dna:dna};
}

function validateFinalPostBatch(items=[]){
  const list=Array.isArray(items)?items:[];
  const errors=[];
  const warnings=[];
  if(list.length<2)errors.push('BATCH_REQUIRES_AT_LEAST_2_FINAL_POSTS');

  const rows=list.map((item,index)=>{
    const context=validateItemContext(item,index);
    errors.push(...context.errors);
    const hook=hookText(item.post,item.input||{});
    const skeleton=hookSkeleton(item.post,item.input||{});
    const archetypeList=archetypes(item.post,item.input||{});
    if(!hook)errors.push('ITEM_'+(index+1)+':HOOK_NOT_DETECTED');
    return {
      index:index+1,
      event:text(item.input&&item.input.event),
      direct_rental_x:text(item.input&&item.input.requested_intent)==='direct_rental_x',
      cta:text(item.post).split(/\r?\n/).map(line=>line.trim()).find(line=>/^👉\s*/u.test(line))||'',
      hook,
      skeleton,
      archetypes:archetypeList,
      event_dna:context.event_dna
    };
  });

  for(let i=0;i<rows.length;i++){
    for(let j=i+1;j<rows.length;j++){
      const score=Qa.similarity(rows[i].skeleton,rows[j].skeleton);
      if(score>=HOOK_SIMILARITY_THRESHOLD){
        errors.push('BATCH_HOOK_NEAR_DUPLICATE:'+rows[i].index+'-'+rows[j].index+':'+score.toFixed(2));
      }
    }
  }

  // Distinct fandom/event CTAs are mandatory across direct-rental batches.
  // Do not block other content categories or change the caller's data.
  for(let i=0;i<rows.length;i++){
    if(!rows[i].direct_rental_x)continue;
    for(let j=i+1;j<rows.length;j++){
      if(!rows[j].direct_rental_x)continue;
      if(rows[i].cta&&rows[i].cta===rows[j].cta)
        errors.push('BATCH_CTA_DUPLICATE:'+rows[i].index+'-'+rows[j].index);
    }
  }

  const archetypeCounts=new Map();
  for(const row of rows){
    for(const key of row.archetypes){
      const refs=archetypeCounts.get(key)||[];
      refs.push(row.index);
      archetypeCounts.set(key,refs);
    }
  }
  for(const [key,refs] of archetypeCounts){
    if(refs.length>MAX_GENERIC_ARCHETYPE_REPEATS){
      errors.push('BATCH_GENERIC_ARCHETYPE_OVERUSED:'+key+':'+refs.join(','));
    }else if(refs.length===MAX_GENERIC_ARCHETYPE_REPEATS){
      warnings.push('BATCH_ARCHETYPE_AT_LIMIT:'+key+':'+refs.join(','));
    }
  }

  return {
    schema_version:VERSION,
    gate:errors.length?'BLOCKED':'PASS',
    publishable:errors.length===0,
    errors:uniq(errors),
    warnings:uniq(warnings),
    thresholds:{
      hook_similarity:HOOK_SIMILARITY_THRESHOLD,
      max_generic_archetype_repeats:MAX_GENERIC_ARCHETYPE_REPEATS
    },
    rows,
    safety:SAFETY
  };
}

module.exports={
  VERSION,SAFETY,HOOK_SIMILARITY_THRESHOLD,MAX_GENERIC_ARCHETYPE_REPEATS,
  normalize,knownAnchors,stripKnownAnchors,hookLines,hookText,hookSkeleton,archetypes,
  validateItemContext,validateFinalPostBatch
};
