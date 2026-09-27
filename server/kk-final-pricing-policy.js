'use strict';

const VERSION='KK_FINAL_PRICING_POLICY_V1';

function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}

function resolve(input={}){
  const rows=Array.isArray(input.store_baseline_prices)?input.store_baseline_prices:[];
  const approved=rows.map(r=>({
    template_id:text(r.template_id||r.package_id),
    override_price:money(r.price),
    active_override:r.active===false?false:true,
    approved:r.approved===true,
    override_note:text(r.override_note||'APPROVED_KK_BASELINE_AUTOFINAL')
  })).filter(r=>r.template_id&&r.override_price&&r.approved);
  const seen=new Set(); const prices=[];
  for(const r of approved){if(seen.has(r.template_id)) continue;seen.add(r.template_id);prices.push({template_id:r.template_id,override_price:r.override_price,active_override:r.active_override,override_note:r.override_note});}
  return {
    schema_version:VERSION,
    status:prices.length?'FINAL_PRICES_RESOLVED':'HOLD_FOR_APPROVED_BASELINE',
    final_prices:prices,
    policy_approved:prices.length>0,
    source:'KK_APPROVED_BASELINE',
    competitor_reference_used_as_final:false,
    requires_per_event_owner_price_decision:false
  };
}
module.exports={VERSION,resolve};
