#!/usr/bin/env node
'use strict';

const Gateway = require('../server/kk-agent-gateway.js');

(async () => {
  const result = await Gateway.executeAgentRequest({
    message: 'ขอโพสปล่อยเช่างานนี้บน X',
    input: {
      event: 'DRY RUN EVENT',
      verified_event: true,
      verified_pricing: true,
      price_display: 'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
      inventory_available: true
    }
  }, {
    ledgerFn: async row => ({
      ok: true,
      inserted: true,
      invocation_id: row.invocation_id,
      mode: 'IN_MEMORY_DRY_RUN'
    })
  });

  console.log(JSON.stringify({
    status: result.status,
    intent: result.intent,
    required_agents: result.invocation && result.invocation.required_agents,
    invoked_agents: result.invocation && result.invocation.invoked_agents,
    ledger: result.ledger,
    production_writes: result.production_writes,
    publishes: result.publishes
  }, null, 2));

  if (result.status !== 'READY_FOR_OWNER_REVIEW') process.exitCode = 2;
})().catch(error => {
  console.error(error && error.stack || String(error));
  process.exitCode = 1;
});
