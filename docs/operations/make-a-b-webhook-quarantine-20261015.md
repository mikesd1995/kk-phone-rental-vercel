# KK Phone Rental — Make A/B webhook quarantine and Telegram isolation

Checkpoint: **2026-10-15 Asia/Bangkok**. Source-only checks and Make guard saves; no legacy activation, queue replay, production writes, merge, deploy or paid top-ups.

## Verified Make readback

| Org / scenario | Status | Queued | lastEdit (UTC) |
|---|---|---:|---|
| A 5901592 Telegram legacy | INACTIVE | 1 confirmed cross-bot echo | 2026-10-14T18:58:32.463Z |
| A 6336390 Admin Write Bridge | INACTIVE | 2 unclassified | 2026-10-12T08:28:16.489Z |
| A 6600107 event-driven gateway | INACTIVE | 0 | 2026-10-13T08:09:22.286Z |
| B 5988323 Telegram staging | INACTIVE | 1 confirmed cross-bot echo | 2026-10-14T18:59:21.605Z |
| B 6032622 historical backup | INACTIVE | 0 | 2026-10-14T19:02:30.527Z |

Total queued = **4**. Make A/B each have one separate ACTIVE **manual/on-demand only** sender, IDs 6634223 and 6634224. Earlier diagnostic sends were accepted by Telegram but produced the opposite account's bot-origin webhook delivery in the shared group. The queued entries have NOT been matched to a selective Queue ID; a webhook log delivery ID is not proof of its Queue ID.

### Saved configuration

- A 5901592: first-hop guard on router module 3 after WatchUpdates 2; human non-bot messages and callbacks from allowlisted group only. Legacy writes/sends disabled. Make note 358174.
- B 5988323: first-hop guard on router module 35 after WatchUpdates 3; exact Owner human, approved group/private messages and callbacks; bot echoes excluded. Normalized malformed flat filter conditions on modules 8, 16, 23, 25, 26, 27, 33 into OR-of-AND arrays. AI, writes and sends disabled. Make note 358175.
- B 6032622: first Sheets-read module 8 guard after WatchUpdates 3; Owner human, group/private only. Writer 6 and sender 10 disabled. Make note 358179.
- A 6336390: 2 queued requests still unclassified, writer 6 disabled, no replay. Make note 358176.

**Unresolved warnings:** B staging placeholder module 34 and B historical backup placeholder module 7. Both omitted from scenario_get; scenario_module_get reports notFound. Do not attempt destructive removal without full Make blueprint inspection. This release gate remains HOLD.

### Offline audit and test

Run: **node --test tests/make-telegram-ingress-contract.test.js**

Run with a redacted connector readback: **node scripts/audit-make-telegram-ingress.cjs PATH_TO_JSON**

The policy audit checks exact scenario identity, INACTIVE status, Telegram trigger, immediate ingress guard, structured filter arrays, non-bot restrictions, Owner/chat scope, callbacks and disabled legacy writers. It does NOT call Make or provide runtime verification. The exact checker was also applied to fresh Make scenario_get results and returned PASS for all three target scenarios (24, 35 and 5 modules respectively). Unit tests passed 14/14 in an isolated JS executor; native Node CI remains a separate gate.

### Safe queue disposition — not performed

The current Make connector allows queue count and recent log inspection but has NO queued-item enumeration/selective-delete action. Make's own UI supports **Webhooks → webhook → Queue → Detail → select exact items → Delete selected** (official guidance: https://help.make.com/webhooks). Do not use Delete all or activate old scenarios to flush messages.

1. Inspect A Admin Bridge 6336390's two unknown pending items. Export only redacted private evidence: queue item ID, webhook identifier, received time, action, request ID, TTL, business scope, canonical status. Do NOT paste payload, signature, secret, customer phone or booking details in public GitHub. If not uniquely verified, retain quarantine.
2. Verify A 5901592's pending item matches the actual B-bot diagnostic message, and B 5988323's pending item matches the actual A-bot diagnostic message. Require matching pending Queue IDs and retained safe evidence; never infer from webhook delivery IDs alone.
3. Only with exact item verification and required owner data-retention approval, selectively delete those verified stale/bot echoes without executing them. Re-read all counts; target zero **verified stale** entries and zero business writes.
4. Isolate webhook ownership and allowed_updates at source: a downstream filter cannot prevent an inactive Webhook queue from **accepting** new bot updates. Otherwise new echoes may recur.
5. Resolve missing placeholder warnings and prove signed TTL + idempotency + durable outbox/ACK + negative auth/replay cases + exact-version CI and owner-approved staging E2E before activating any replacement Production route.

### Gates and rollback

DONE: Saved first-hop guards, normalized B filter structure, 3 saved-blueprint readbacks, manual transport proof (prior run), recorded four queued counts. 
NOT DONE: Four selective queue dispositions (2 unclassified), missing placeholder repair, true webhook/runtime/owner callback UAT, sustained no-echo source isolation and approved cutover.

**Rollback:** Preserve legacy inactive state and disabled writers, leave new event gateway fail-closed. Never merge/deploy this doc/test-only draft without safety approvals. Org verification: Free A 999/1000 and Free B 999/1000 credits unused; auto purchase OFF. No metered Make runs in this remediation.

History: GitHub Issues #696 and #740, including exact 2026-10-15 checkpoint; PR #697 is a separate draft gateway proposal, not released.
