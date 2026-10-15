# KK Phone Rental — Stable Business V1 P0 closure checkpoint (15 Oct 2026 ICT)

Owner-selected scope: secure Storefront, Booking/Stock, Apps Script, LINE/Inbox and Revenue. Explicitly defer autonomous Agent, Scanner/Verifier, Make activation, AI Pricing, X auto publish and new UX scope to a later independently gated phase. Leave their current safety holds unchanged.

## Changes staged safely in existing Draft PR #739
At starting GitHub HEAD 84713248674eb1035fbff2326883089f5f67a319 on branch fix/core-sheets-privacy-private-read-gates-20261014, harden read-only private Core Apps Script transport against URL userinfo and nonstandard TLS ports at three boundaries: configured endpoint, Google ContentService redirect, response final URL. Legitimate https://script.google.com/macros/s/.../exec and https://script.googleusercontent.com/macros/echo?user_content_key=... remain authorized.
Extend focused unit test cases for bad configured URLs, malicious redirects and malicious final response URLs. Syntax of source and tests parsed in isolated JavaScript V8. No full Node/GitHub CI, live Script E2E or Production acceptance is claimed.

## P0 closure gates in order
1. Booking operations #714: obtain actual nonblank pickup/return windows for 2 confirmed devices on Oct 17 and 2 on Oct 18. Do not invent customer data, bookings, or prices; preserve booked-day stock locks.
2. Security #738 / PR #739: currently Core shared anyone/reader. Configure independent 32+ character private Apps Script read key in owner-authenticated Script Properties and matching Vercel secrets (never GitHub/logs). Prove strict 13/13 real private dataset reads, cross-key denial, no public Core GViz, private Admin and storefront parity. Only after explicit owner authorization and zero-downtime rollback, revoke existing public Core permission and read back anonymous-deny/legitimate-allow.
3. Poster security #718/#743 / PR #721: 35 active Drive images + 4 folders Anyone Writer. New active 35/44 manifest staged only. Owner must review exact dry-run fingerprint, scope all current/historical images, change existing permissions in separately authorized bounded batches, read back and confirm signed-out poster availability. No incorrect grant-only workaround.
4. Apps Script Gate 2 #9: Production source still 9.5.9 vs repo 9.5.13; no owner-authenticated Apps Script deployment authority. Establish exact identity, rollback, trigger, timezone, new approved version and signed Booking/LINE idempotent E2E before toggling automation.
5. LINE/Inbox #715/#742/#750: signed owner approve/reject, customer receipt, replay zero sends, no duplicate notification, private media access and Admin reply; historical unavailable media must remain unavailable.
6. Revenue #710: Actual completed-only, Future pending/confirmed/prepared/picked_up/returned/uploaded, excluded cancelled/no_show; reconciled against canonical Master quoted package price and private API.
7. Exact candidate SHA source/CI/security/mobile visual readback, budget verification, owner review, rollback, governed merge/deploy and postrelease validation. GitHub main branch protection/rulesets require separately authorized administrative action.

## Non-negotiable safety
Zero added spend, no Merge/Deploy, no live credentials, ACL, customer, Booking, price, LINE sends or automation writes before checks and owner approval. No duplication from PR #744/#751; pick one authorized release candidate. Issue #49 remains OPEN until Stable Business V1 verified live. All SHA/test and blockers logged there without customer PII or secrets.