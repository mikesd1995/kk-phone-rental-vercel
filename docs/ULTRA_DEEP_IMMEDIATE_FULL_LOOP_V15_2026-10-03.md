# Ultra Deep Immediate Full Loop V15 — 2026-10-03

## Owner instruction

Run the Full Loop immediately: discover events, verify them, compare competitor pricing, compare against KK storefront/Core, and publish qualifying events that have never appeared on the storefront.

Production writes are explicitly authorized for this governed Full Loop. Existing safety rules remain mandatory.

## What V15 adds

1. Candidate-level Verifier runtime
   - raw search evidence is never treated as a publishable event;
   - requires target-month event date, event identity, venue, verified HTTPS poster and rental-fit score;
   - parses structured JSON-LD Event metadata when available;
   - incomplete/noisy rows become terminal HOLD/NOT-ELIGIBLE, never production writes.

2. Zero-cost competitor price scanner
   - searches only the locked KK competitor account set;
   - accepts only X/Twitter evidence from those accounts;
   - requires title overlap and a bounded THB rental price;
   - distinguishes phone base price plus lens add-on from true bundle pricing;
   - zero evidence routes to the approved fallback policy instead of inventing a price.

3. Exact-event market pricing
   - exact competitor phone prices are medianed;
   - bundle evidence is converted to phone-equivalent by subtracting the approved lens baseline;
   - phone and bundle final prices are generated from the market median;
   - standalone lens stays hidden;
   - if no exact evidence exists, the existing rental-fit fallback policy remains authoritative.

4. Production SOT reconciliation
   - loads fresh Core/Admin snapshot: events, bookings, packages, overrides, visibility locks, web-ready and web-packages;
   - booking dates are skipped;
   - owner-hidden/history rows are skipped;
   - existing events are reconciled by exact identity, deterministic known-miss identity, or strong same-date/venue/title match;
   - ambiguous existing matches HOLD instead of creating duplicates.

5. Governed production execution
   - no second writer is introduced;
   - creates still use `kk-governed-storefront-executor` → `/api/kk-admin-guard`;
   - existing price/poster updates use the same guarded Admin path;
   - exact readback comes from fresh `08_Web_Ready` and `09_Web_Packages` data after each write.

6. Secretless workflow-to-production authorization
   - GitHub Actions obtains an OIDC token;
   - Vercel verifies JWT signature plus repository, owner, main ref, workflow, run ID, SHA, actor and event;
   - `KK_ADMIN_PIN` never leaves the production runtime.

7. Immediate deployment recovery
   - Direct Full Loop probes the deployed production executor SHA;
   - when production is not on the exact current main SHA, the workflow runs full regression and uses the existing Vercel prebuilt deployment path;
   - this avoids hosted-build quota dependency.

## Direct command

`/run-ultra-deep-full-loop YYYY-MM`

The same command now executes:

Discovery FULL → Verifier → competitor price scan → commercial pricing → production SOT reconciliation → governed create/update → exact storefront readback → final COMPLETE/PARTIAL/BLOCKED report.

## Safety invariants

- Scanner discovery remains `production_writes=0`.
- Verifier and price scanner remain `production_writes=0`.
- Only production runtime may execute writes after OIDC authorization.
- Previously hidden/history events are never recreated automatically.
- Any date with an active booking is skipped.
- Ambiguous existing-event identity fails closed.
- No paid browser/search dependency is introduced.
