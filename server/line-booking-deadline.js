'use strict';

const DEADLINE_MS=6000;

// One absolute transport/body budget, independent of AbortSignal cooperation.
// A timeout never retries an operation or establishes a delivery receipt.
async function fetchWithDeadline(fetchImpl,url,options={},consume=response=>response){
  const controller=new AbortController();
  let timer;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const error=new Error('LINE booking network deadline exceeded');
      error.code='LINE_BOOKING_NETWORK_DEADLINE_EXCEEDED';
      // Reject first so even an immediate transport abort uses our fixed code.
      reject(error);
      controller.abort();
    },DEADLINE_MS);
  });
  try{
    return await Promise.race([
      Promise.resolve().then(()=>fetchImpl(url,{...options,signal:controller.signal})).then(consume),
      deadline
    ]);
  }finally{
    clearTimeout(timer);
  }
}

module.exports={DEADLINE_MS,fetchWithDeadline};
