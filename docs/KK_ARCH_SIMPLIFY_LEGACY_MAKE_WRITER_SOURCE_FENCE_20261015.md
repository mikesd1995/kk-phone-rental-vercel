# KK Architecture Simplification — P0 legacy Make commercial writer source fence
**2026-10-15 Asia/Bangkok | DRAFT SOURCE CHANGE ONLY | RELEASE HOLD**

## Root cause and architectural decision
- The API route `server/admin-make-gate.js` is disabled, but `server/admin-make-bridge.js:callBridge()` was callable without going through that route. It could directly send a signed **commercial Google Sheets write** to a hardcoded old Make webhook when called by another module.
- This is an unwanted parallel writer alongside the owner-controlled Apps Script / staged Direct Writer and violates the selected single-commercial-writer architecture.
- Owner Make A/B on-demand Telegram notification senders are a separate transport, **not affected**. All retired CRM/scout Make writers remain OFF.

## Implementation on Draft PR #744
- Retire the committed legacy webhook URL from the current source (prior git history may still expose that URL; treat it as compromised and do not reuse).
- Introduce `LEGACY_TRANSPORT_QUARANTINED=true` at module scope, with unconditional fail-closed `BRIDGE_RUNTIME_QUARANTINED` at the beginning of `callBridge()`. No config/env/HTTP path can turn it off.
- Preserve signature validation and historical request envelope analysis for audit tests, but do not permit delivery from this code.
- New regression test checks two direct bypass attempts (health and Booking write), zero synthetic external calls, and no committed Make webhook literal.
- In-memory JavaScript evaluation of the **exact patched module text**: 2/2 direct-call negative cases PASS, health plan validation PASS, outbound calls 0. Native Node full regression/Actions exact-HEAD remain pending separate acceptance; this is not evidence of a Production fix.

## Migration dependency
Target **one governed commercial writer**: Apps Script owner-controlled authority after Gate #9, with Direct Writer only if separately fenced/approved as failover. Make is **notification-only** via durable outbox, signature/TTL/dedupe/ACK; never authorizes commercial Core Sheets writes. Inactive legacy Make scenarios and any historical CRM rows remain preserved.
Security Core #738, Poster #718/#743, Booking/LINE #714/#715, Scanner #47, Make #740, CI #749 remain HOLD. Do not merge/deploy or enable any writer on this note.

## Safety
No Production changes, no Vercel/Supabase release, no webhook/LINE/X/Telegram call, no Sheets/Drive ACL changes, no customer/booking/price/stock writes, no Make state changes, no deletion and no paid provider operations. Preserve Issue #49 OPEN.
