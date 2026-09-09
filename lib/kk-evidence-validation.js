'use strict';

// Sheets may return numeric cells as numbers or decimal integer strings.
// Missing/boolean/negative/non-finite values are not evidence of zero debt.
function evidenceCount(value){
  if(typeof value==='string'){
    if(!/^(0|[1-9]\d*)$/.test(value.trim())) return null;
    value=Number(value.trim());
  }
  return typeof value==='number' && Number.isSafeInteger(value) && value>=0 ? value : null;
}
function evidenceTrue(value){return value===true || (typeof value==='string' && value.trim().toUpperCase()==='TRUE');}
function evidenceTimestamp(value){
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  if(!Number.isFinite(Date.parse(value))) return false;
  const date=value.slice(0,10);
  return new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
}
function readCount(input,key,reasons){
  const value=evidenceCount(input[key]);
  if(value===null) reasons.push('INVALID_OR_MISSING_'+key.toUpperCase());
  return value;
}
module.exports={evidenceCount,evidenceTrue,evidenceTimestamp,readCount};
