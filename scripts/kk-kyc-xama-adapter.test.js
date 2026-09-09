'use strict';

const {xamaToKycAttestation}=require('../lib/kk-kyc-xama-adapter');
let passed=0,total=0;
function t(name,fn){total++;try{fn();passed++;console.log(`PASS ${name}`);}catch(e){console.error(`FAIL ${name}: ${e.message}`);process.exitCode=1;}}
function ok(v,m){if(!v)throw new Error(m);}
function throws(fn,needle){let e=null;try{fn();}catch(err){e=err;}ok(e,'expected throw');if(needle)ok(String(e.message).includes(needle),`expected ${needle}, got ${e.message}`);}

const now=Date.parse('2026-09-05T06:00:00Z');
function base(){return {
  customer_ref:'CUST-OPAQUE-001',
  request_binding:{verified:true,provider_request_id:'ONB-123',subject_ref:'CUST-OPAQUE-001',evidence_ref:'SYNTHETIC_REQUEST_BINDING'},
  now_ms:now,
  provider_policy:{
    authority:'XAMA_ONBOARDING_V1',
    accepted_statuses:['completed'],
    accepted_review_decisions:['approved'],
    accepted_document_decisions:['accepted'],
    require_face_match:true,
    face_match_evidence_verified:true
  },
  provider_result:{
    id:'ONB-123',
    status:'completed',
    config:{parameters:{face_match:'true'}},
    review:{decision:'approved',status:'complete'},
    data:{
      refreshed_at:'2026-09-05T05:50:00Z',
      report_link:'https://provider.invalid/report/opaque-token',
      idscan:{
        document_decision:'accepted',
        document_decision_date:'2026-09-05T05:49:00Z',
        document_given_names:'SHOULD_NOT_LEAK',
        document_last_name:'SHOULD_NOT_LEAK',
        passport_number:'SHOULD_NOT_LEAK'
      }
    }
  }
};}

t('creates minimal verified attestation from exact accepted provider decisions',()=>{
  const a=xamaToKycAttestation(base());
  ok(a.verified===true,'verified');
  ok(a.subject_ref==='CUST-OPAQUE-001','subject');
  ok(a.authority==='XAMA_ONBOARDING_V1','authority');
  ok(a.evidence_ref.includes('ONB-123'),'provider id');
  ok(!JSON.stringify(a).includes('SHOULD_NOT_LEAK'),'PII leaked');
});

t('requires explicit status allowlist',()=>{const x=base();x.provider_policy.accepted_statuses=[];throws(()=>xamaToKycAttestation(x),'explicit allowlist');});
t('rejects nonaccepted provider status',()=>{const x=base();x.provider_result.status='pending';throws(()=>xamaToKycAttestation(x),'status not accepted');});
t('rejects nonaccepted review decision',()=>{const x=base();x.provider_result.review.decision='rejected';throws(()=>xamaToKycAttestation(x),'review decision not accepted');});
t('rejects nonaccepted document decision',()=>{const x=base();x.provider_result.data.idscan.document_decision='rejected';throws(()=>xamaToKycAttestation(x),'document decision not accepted');});
t('requires face-match request when policy requires it',()=>{const x=base();x.provider_result.config.parameters.face_match='false';throws(()=>xamaToKycAttestation(x),'face-match requirement');});
t('requires independent face-match evidence gate',()=>{const x=base();x.provider_policy.face_match_evidence_verified=false;throws(()=>xamaToKycAttestation(x),'face-match verification evidence');});
t('requires provider request id',()=>{const x=base();x.provider_result.id='';throws(()=>xamaToKycAttestation(x),'provider request id');});
t('requires report/evidence reference',()=>{const x=base();x.provider_result.data.report_link='';x.provider_result.data.idscan.document_report_link='';throws(()=>xamaToKycAttestation(x),'evidence/report reference');});
t('rejects future verification timestamp',()=>{const x=base();x.provider_result.data.idscan.document_decision_date='2026-09-05T07:00:00Z';throws(()=>xamaToKycAttestation(x),'future');});
t('rejects unexpected authority alias',()=>{const x=base();x.provider_policy.authority='OCR_ONLY';throws(()=>xamaToKycAttestation(x),'unexpected Xama authority');});
t('does not return provider personal fields',()=>{const a=xamaToKycAttestation(base());for(const k of ['document_given_names','document_last_name','passport_number','date_of_birth','street'])ok(!(k in a),`returned ${k}`);});

t('report URLs never leave provider boundary',()=>{const x=base();x.provider_result.data.report_link='https://provider.invalid/report?token=PRIVATE_REPORT_TOKEN';ok(!JSON.stringify(xamaToKycAttestation(x)).includes('PRIVATE_REPORT_TOKEN'),'signed report token leaked');});
t('malformed face-match policy cannot disable the gate',()=>{const x=base();x.provider_policy.require_face_match='TRUE';x.provider_policy.face_match_evidence_verified=false;throws(()=>xamaToKycAttestation(x),'require_face_match');});
t('missing request to subject binding cannot attest arbitrary customer',()=>{const x=base();delete x.request_binding;throws(()=>xamaToKycAttestation(x),'request binding');});
t('wrong subject or provider request binding is refused',()=>{for(const key of ['subject_ref','provider_request_id']){const x=base();x.request_binding[key]='OTHER';throws(()=>xamaToKycAttestation(x),'request binding');}});
console.log(`\n${passed}/${total} Xama KYC adapter assertions PASS`);
if(passed!==total)process.exitCode=1;
