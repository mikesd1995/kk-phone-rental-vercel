#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Signals=require('../server/kk-operating-partner-signals.js');

const root=path.resolve(__dirname,'..');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests','fixtures','kk-operating-partner-signal-benchmark.json'),'utf8'));
const nowMs=Date.parse(fixture.now);
const rows=[];
let passed=0;

for(const item of fixture.cases||[]){
  const checked=Signals.normalizeSignal(item.signal,{nowMs});
  let actual='ACCEPT';
  if(checked.errors.length) actual='INVALID';
  else if(!checked.signal.freshness.fresh) actual='STALE';
  else if(checked.signal.dropped_metrics.length) actual='ACCEPT_WITH_DROP';
  const ok=actual===item.expect;
  if(ok) passed+=1;
  rows.push({
    name:item.name,
    expected:item.expect,
    actual,
    pass:ok,
    errors:checked.errors,
    dropped_metrics:checked.signal.dropped_metrics,
    freshness:checked.signal.freshness.status
  });
}

const result={
  schema_version:'KK_OPERATING_PARTNER_SIGNAL_BENCHMARK_RESULT_V1',
  cases:rows.length,
  passed,
  failed:rows.length-passed,
  pass:passed===rows.length,
  rows
};
console.log(JSON.stringify(result,null,2));
if(!result.pass) process.exitCode=2;
