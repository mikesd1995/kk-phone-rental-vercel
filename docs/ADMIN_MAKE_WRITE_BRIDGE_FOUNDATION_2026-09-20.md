# Admin Make write bridge foundation — 2026-09-20

## Purpose

Provide a controlled authenticated Google Sheets write transport that does not depend on the currently missing Apps Script Web App deployment.

This foundation does **not** route Admin business writes to Make yet. It establishes and verifies the transport first.

## Architecture

Vercel remains the policy/validation authority. Make is only the Google OAuth execution transport.

Flow:

1. Vercel constructs an allowlisted Sheet operation.
2. Vercel signs the complete operation envelope with HMAC-SHA256 using the existing server-side `KK_ADMIN_API_KEY`.
3. Make calls Vercel `/api/kk-admin-make-verify` before touching Google.
4. Make reads the signed precondition range using the existing owner Google OAuth connection.
5. Make sends the actual values back to Vercel for precondition verification.
6. Only after a 2xx verification may Make execute the signed Sheets API operation.
7. Make sends the Google response back to Vercel for readback validation.
8. Make returns the verifier result to the Vercel caller.

The Make scenario is configured sequentially so only one bridge execution reaches Google at a time.

## Security controls

- Webhook URL secrecy is not the authorization boundary.
- The webhook does not possess `KK_ADMIN_API_KEY`.
- Request signature covers protocol, request id, timestamp, action, read path, write method, write path, write-body hash, before hash and after hash.
- Signed requests expire after a bounded clock-skew window.
- Action allowlist and action-to-Sheet mapping are enforced by Vercel.
- All paths are restricted to the production Core spreadsheet.
- Make HTTP verifier steps stop on non-2xx responses.
- Google Sheets access uses the existing connected owner OAuth account.
- No PIN/API key/customer payload is written to GitHub or Make configuration.

## Make runtime

Scenario: `05_KK_ADMIN_WRITE_BRIDGE`
Scenario ID: `6336390`

The scenario uses:
- Custom webhook trigger
- signed authorize callback
- Google precondition read
- precondition serializer
- signed precondition callback
- guarded Google Sheets operation
- response serializer
- signed readback callback
- synchronous webhook response

The Google connection used by the bridge reports status `ok`.

To free one active-scenario slot during recovery, `03_KK_OWNER_TELEGRAM_LEDGER_TRANSPORT` (scenario `6176241`) was deactivated. `02_KK_TELEGRAM_CONTROL` was not changed. This displacement must remain recorded until capacity is expanded or the old transport is retired/re-enabled.

## Related correctness repair

The direct-Sheet fallback previously derived `__row_number` relative to a range beginning at row 4. This made displayed row numbers different from physical Sheet row numbers, which is unsafe for direct update planning.

The fallback parsers now receive the physical start row and preserve real Sheet coordinates. Regression tests cover both public GViz and private-reader paths.

## Rollout gates

Before any Admin business write is routed to this bridge:

1. CI passes.
2. Vercel verifier/health endpoint deploys.
3. Production bridge health performs a read-only Google OAuth round trip successfully.
4. A no-op/idempotent non-customer write acceptance is performed with before/after readback.
5. Direct write planners for each enabled Admin action pass regression tests.
6. Booking/event guards remain fail-closed.
7. No synthetic production booking is created.

Apps Script 9_5_9 recovery remains useful for provenance, but this bridge removes it as a mandatory transport dependency once the write acceptance gates pass.
