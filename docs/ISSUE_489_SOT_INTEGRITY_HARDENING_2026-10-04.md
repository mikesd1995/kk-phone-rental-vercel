# Issue #489 — SOT integrity hardening execution

Date: 2026-10-04
Mode: repository hardening only; no production business-data mutation.

## Confirmed baseline
The 2026-10-02 canonical SOT audit reported zero active-booking event orphans, duplicate package IDs, web-package/event or web-ready/event orphans, override reference orphans, duplicate override keys, duplicate booking IDs, booking integrity risks, and negative raw availability. Production public feeds remained on public-gviz-fallback because the private read-only service-account credential was not configured.

## Changes
1. Extended the existing continuous invariant gate with CANONICAL_IDENTITY_AND_PROJECTION_EVIDENCE. It requires the accepted snapshot-health implementation to retain checks for missing/duplicate stable identities, current-booking projection mismatch, orphan web packages/web-ready rows, and negative availability.
2. Added GENERATED_PRICE_FORMULA_PRESERVED. It locks the direct-writer contract that generated 09_Web_Packages price output is rebuilt from the canonical formula/override path and verified using FORMULA readback, preventing a silent return to stale hard-coded prices.
3. Added REVENUE_POLICY_FAIL_CLOSED. It locks completed -> Actual, pending/confirmed/prepared/picked_up/returned/uploaded -> Future, with cancelled/no_show/blank/unknown excluded.
4. Updated the continuous-invariant regression test to require all three checks.

## Safety / repair admission
No canonical Sheet row is changed by this patch. A future repair remains blocked until the anomaly can be tied to an unambiguous canonical row/key and bounded readback/rollback evidence. Private-reader strict mode remains disabled until production has a read-only service-account credential and both allowed feeds pass private-reader parity acceptance.

## Acceptance
The repository already wires `npm run audit:invariants` into Admin Regression for PRs and main. This patch therefore makes the new contracts part of the existing CI gate rather than introducing an ungoverned writer or one-off repair path.
