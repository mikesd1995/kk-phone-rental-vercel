'use strict';

const VERSION='kk-event-dedup-shadow-v1';

function text(value){ return String(value==null?'':value).trim(); }

function normalizeText(value){
  return text(value)
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/&/g,' and ')
    .replace(/[\s\-_.,/\\()[\]{}:;'"`!?@#$%^*+=|<>~]+/g,'')
    .trim();
}

function normalizeDate(value){
  const raw=text(value);
  if(!raw) return '';
  const m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if(m){
    let y=Number(m[1]); if(y>2500)y-=543;
    return `${String(y).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  }
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}

function ngrams(value,n=3){
  const s=normalizeText(value);
  if(!s) return new Set();
  if(s.length<=n) return new Set([s]);
  const out=new Set();
  for(let i=0;i<=s.length-n;i++) out.add(s.slice(i,i+n));
  return out;
}

function jaccard(a,b){
  if(!a.size && !b.size) return 1;
  if(!a.size || !b.size) return 0;
  let intersection=0;
  for(const item of a) if(b.has(item)) intersection++;
  return intersection/(a.size+b.size-intersection);
}

function similarity(a,b){ return jaccard(ngrams(a),ngrams(b)); }

function normalizeArtists(value){
  const list=Array.isArray(value)?value:String(value==null?'':value).split(/[,&/|]+/g);
  return Array.from(new Set(list.map(normalizeText).filter(Boolean)));
}

function artistSimilarity(a,b){
  const left=new Set(normalizeArtists(a));
  const right=new Set(normalizeArtists(b));
  return jaccard(left,right);
}

function evaluatePair(candidate={},existing={}){
  const candidateDate=normalizeDate(candidate.event_date);
  const existingDate=normalizeDate(existing.event_date);
  const nameSimilarity=similarity(candidate.event_name || candidate.title,existing.event_name || existing.title);
  const venueSimilarity=similarity(candidate.venue,existing.venue);
  const artistsSimilarity=artistSimilarity(candidate.artists || candidate.artist,existing.artists || existing.artist);

  const hardDateConflict=Boolean(candidateDate && existingDate && candidateDate!==existingDate);
  if(hardDateConflict){
    return {
      version:VERSION,
      disposition:'DISTINCT_HARD_DATE',
      score:0,
      authoritative:false,
      verifier_required:true,
      production_writes:0,
      reasons:['different explicit event dates'],
      metrics:{name_similarity:nameSimilarity,venue_similarity:venueSimilarity,artist_similarity:artistsSimilarity}
    };
  }

  const dateScore=candidateDate && existingDate ? 1 : 0.5;
  const score=(nameSimilarity*0.55)+(artistsSimilarity*0.20)+(dateScore*0.20)+(venueSimilarity*0.05);
  const reasons=[];

  if(nameSimilarity>=0.88) reasons.push('high title similarity');
  if(artistsSimilarity>=0.80) reasons.push('artist identity overlap');
  if(candidateDate && existingDate && candidateDate===existingDate) reasons.push('same explicit date');
  if(venueSimilarity>=0.80) reasons.push('venue similarity');

  let disposition='DISTINCT';
  if(candidateDate && existingDate && candidateDate===existingDate && nameSimilarity>=0.90 && (venueSimilarity>=0.75 || artistsSimilarity>=0.80)){
    disposition='LIKELY_DUPLICATE';
  } else if(score>=0.72){
    disposition='POSSIBLE_DUPLICATE';
  } else if(nameSimilarity>=0.86 && !candidateDate && !existingDate){
    disposition='POSSIBLE_DUPLICATE';
    reasons.push('strong title match but date evidence missing');
  }

  return {
    version:VERSION,
    disposition,
    score:Number(score.toFixed(4)),
    authoritative:false,
    verifier_required:true,
    production_writes:0,
    reasons,
    metrics:{
      name_similarity:Number(nameSimilarity.toFixed(4)),
      venue_similarity:Number(venueSimilarity.toFixed(4)),
      artist_similarity:Number(artistsSimilarity.toFixed(4)),
      date_match:candidateDate && existingDate ? candidateDate===existingDate : null
    }
  };
}

function rankCandidates(candidate={},existingRows=[],options={}){
  const limit=Number.isInteger(options.limit) && options.limit>0 ? Math.min(options.limit,20) : 5;
  return (Array.isArray(existingRows)?existingRows:[])
    .map(row=>({existing_id:text(row.event_id || row.candidate_id),...evaluatePair(candidate,row)}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,limit);
}

module.exports={
  VERSION,
  normalizeText,
  normalizeDate,
  ngrams,
  jaccard,
  similarity,
  normalizeArtists,
  artistSimilarity,
  evaluatePair,
  rankCandidates
};
