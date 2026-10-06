'use strict';
const Verifier=require('../server/kk-ultra-deep-candidate-verifier.js');

module.exports=async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(String(process.env.VERCEL_ENV||'')!=='preview'){
    res.statusCode=404; return res.end(JSON.stringify({ok:false,error_code:'PREVIEW_ONLY',production_writes:0}));
  }
  const html='<!doctype html><html><head><script type="application/ld+json">'+JSON.stringify({
    '@context':'https://schema.org','@type':'Event',
    name:'Strong Roots Bright Stars with TeeTee & Por',
    startDate:'2026-10-07T18:00:00+07:00',
    location:{'@type':'Place',name:'Union Hall'},
    image:'https://cdn.example/ryo.jpg'
  })+'</script></head><body>official event detail</body></html>';
  const missingDate={title:'Strong Roots Bright Stars with TeeTee & Por',event_date:null,source_url:'https://www.eventpop.me/e/ryo-strong-roots'};
  const dated={...missingDate,event_date:'2026-10-07'};
  const ctx={month:'2026-10',verification_scope:'EXTERNAL_DEMAND_IDENTITY'};
  const externalMissing=Verifier.verifyHtmlCandidate(missingDate,html,ctx);
  const legacyMissing=Verifier.verifyHtmlCandidate(missingDate,html,{month:'2026-10'});
  const externalDated=Verifier.verifyHtmlCandidate(dated,html,ctx);
  const genericPre=Verifier.prefilter({title:'Strong Roots Bright Stars with TeeTee & Por',event_date:null,source_url:'https://example.com/search-result'},'2026-10',ctx);
  const checks={
    external_missing_date_verified:externalMissing.verified===true&&externalMissing.candidate&&externalMissing.candidate.event_date==='2026-10-07',
    external_keywordless_deferred:externalDated.verified===true&&externalDated.candidate&&externalDated.candidate.publish_eligibility&&externalDated.candidate.publish_eligibility.status==='DEFER_TO_EXTERNAL_DEMAND_GATE',
    legacy_missing_date_still_blocked:legacyMissing.verified===false&&Array.isArray(legacyMissing.blockers)&&legacyMissing.blockers.includes('EVENT_DATE_REQUIRED'),
    generic_missing_date_still_blocked:genericPre.eligible===false&&genericPre.reasons.includes('EVENT_DATE_REQUIRED')&&genericPre.reasons.includes('EVENT_IDENTITY_NOT_STRONG_ENOUGH')
  };
  const ok=Object.values(checks).every(Boolean);
  res.statusCode=ok?200:409;
  res.end(JSON.stringify({ok,version:Verifier.VERSION,checks,production_writes:0}));
};
