# Owner Prepare/ACK route restoration — 2026-10-21

The held Make A scenario 6600107 references `/api/kk-make-owner-notify`, but production source `265203ce12a4093a46607fe3a365684794a5b382` does not contain that route and an actual read returned 404. This change restores the queued owner-only v1 transport through the existing Scanner dispatcher, retaining the twelve-function footprint. It does not enable a producer, Make scenario, canonical task or provider sender.

## Preserved boundaries and repairs

- The pretty URL and dedicated `owner_transport=v1` selector resolve before Scanner and machine command paths; invalid, duplicate or conflicting selectors reject without falling through.
- The existing signed v1 envelope, owner-only Telegram audience, OWNER_ALERT type, 120-second TTL, explicit environment binding and durable claim/ACK RPCs remain required. The helper never calls Telegram or LINE.
- A claim must return exactly one plain row and a valid UUID. ACK must return exactly one SENT row echoing the exact submitted provider message ID.
- Plain JSON with exact string stages and stage-specific allowed fields prevents coercion and shadow fields. Requests are bounded to 10,000 UTF-8 bytes; buffered decoding preserves split Thai characters and signatures.
- A five-second abort deadline covers RPC fetch and JSON parsing. Redirects are rejected. Signature/TTL are rechecked after the durable claim before granting send permission.

## Evidence before release

Planner, Implementer and independent Reviewer artifacts are in `outputs/kk-owner-gateway-release-20261021/` in the task workspace, with earlier root-cause evidence in `outputs/kk-scanner-causal-closure-20261020-2018/`. The final seven source/test file hashes are pinned by the independent review report.

- Focused tests: 43/43; context-selected regression: 56/56.
- Full regression: 2,021/2,021, plus poster ACL 29/29; zero failed or skipped.
- Independent focused rerun: 43/43, plus sixteen role-boundary cases with zero network/command/scan activity and three byte-compatible v1 JSON-wire cases.
- Syntax checks and diff checks succeeded. Expected failing tests were retained before each repair, including the additional stage-coercion finding.
- Source review is accepted with no blocking findings. Hosted exact-head CI and production acceptance remain separate gates.

## Live prerequisites and release acceptance

The 00:57–01:00 Bangkok preflight found Machine SOT GLOBAL v4.9.44 exact-one, 458 Active policy rows, no active locks or pending transactions, and unchanged reconciliation 1266/1282/1283. Canonical Scanner/Verifier remain PAUSED; Make A6176241/A6600107/B5988323 remain inactive and held.

Vercel project metadata was read without decrypting values: all four transport settings (enable flag, project binding, signing secret and owner chat ID) were absent in every project scope, with no hidden production environment records. No environment change is part of this release. The running deployment configuration must nevertheless be checked after rollout.

Required production readback: intended source/tree and READY canonical alias; owner GET returns 405; owner Prepare and ACK POST return 503 with `send_allowed:false`; invalid selectors return 400 rather than Scanner readiness; existing critical read-only routes retain behavior; the accepted nineteen-file storefront digest remains unchanged; actual outbox/provider/Sheet/Make/task state shows no unintended writes. Hosted CI and runtime readback must be recorded against the exact released identity before scoped acceptance.

Rollback target before this release is production `dpl_EsEQNVEdb22uMQB9Lgz14qaZxnoa`, source `265203ce12a4093a46607fe3a365684794a5b382`. Inspect current runtime/receipts before any rollback. No database schema change is included; the already-installed ACK NULL guard migration `20261020130318` must not be replayed.

## Remaining independent gates

This restoration can close the missing-route defect while deliberately rejecting send requests under current configuration. It does not establish positive live Prepare/ACK, signed producer binding, actual provider delivery, or a natural Scanner → Verifier → Sheet → Telegram and LINE acknowledgment join. Current Make HOLD replies and disabled modules are preserved. Before future activation, actual mapping/types, provider evidence, single-writer fencing and policy authority require separate acceptance.

OpenAI case 17503357 already contains the authorized follow-up. At the 00:56–00:58 refresh no newer reply was visible; existing-case ingestion is verified, while the Scanner historical task-update input and a supported cause-specific correction remain unavailable. Do not resend, clone, reschedule, restore tasks, backfill, or substitute a manual sender to conceal that gap. Whole-project closure remains open until the required actual circuit evidence exists.
