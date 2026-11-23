# KK Phone Rental — Isolated GAS Private Reader Staging (2026-11-23)

## What this does / does not do

This is an intentionally **read-only**, **synthetic-only** Google Apps Script Web App source: `apps-script/staging/Code.gs`. It is **not** `apps-script/Code.gs`, must not be pasted into production GAS, and has **no** booking writer, terms acceptance, outbox claim, LINE reply/push, or production cutover logic. Source and offline contract tests are not proof of an actual published GAS version.

The real owner-only synthetic Google Sheet ID and exact access details are held in the private owner Engineering History & UAT Log; **never put that ID, a reader secret, or any real LINE U-ID in this repository, GitHub Issues, test snapshots or browser code**.

## Manual, separate GAS-bound staging deployment (not yet performed)

1. Open the existing **synthetic staging workbook**, not the canonical Core or a customer-filled copy. Confirm Drive shows only the owner permission; both outbox tables must still be header-only.
2. From that staging spreadsheet's **Extensions → Apps Script**, create or open its **own distinct container-bound script**. Verify editor project/owner and actual bound spreadsheet. Never reuse the canonical GAS project's Script ID or deployment.
3. Paste *only* the file `apps-script/staging/Code.gs`. Do not paste the full `apps-script/Code.gs`; they both implement `doPost` and are incompatible in one deployment.
4. In the staging script's Script Properties, set **only staging-specific values**: `KK_STAGING_SHEET_ID` to the private staging ID, `KK_STAGING_PRIVATE_READ_ENABLED=1`, and `KK_CORE_PRIVATE_READ_KEY` to an owner-generated fresh random base64url secret (at least 32 characters). It **must differ** from `KK_ADMIN_API_KEY`, any production read key, any LINE key and all dispatcher secrets. Never record secret values in documents/logs. Locally use `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` on a trusted operator machine.
5. Deploy a **new immutable staging Web app version**, executing as the script owner. The Vercel server will invoke it over HTTPS as a machine caller; if provider access must be set to "Anyone", the long one-purpose request key, exact allowlist, owner-private ACL and staging sentinel are mandatory. The script intentionally provides no GET endpoint; if unauthorized requests return only a generic denial, do not treat this as proof of user authentication. Record only version/deployment identifiers, no secret.
6. Do **not** change production Vercel environment variables. For an explicitly isolated staging Preview only, bind `GOOGLE_SHEET_ID` to the synthetic workbook, `KK_CORE_SHEET_REQUIRE_PRIVATE=1`, `KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1`, `KK_CORE_PRIVATE_TRANSPORT=apps-script`, `KK_ADMIN_SCRIPT_URL` to the staging `/exec`, and `KK_CORE_PRIVATE_READ_KEY` to that staging-only secret. Disable native LINE booking, outgoing messages, booking mutations and all other real provider integrations. Avoid preview fixture overrides hiding an unconfigured reader.

## Exact source contract

* Accepts only POST action `privateCoreRead` with the staging sheet ID, valid read key, `08_Web_Ready!A4:K` or `09_Web_Packages!A4:N`.
* Before every read, verifies `SpreadsheetApp.getActiveSpreadsheet().getId()`, exact private-only file ACL (no any-link, viewers or editors), the unique synthetic README sentinel, the dedicated enabled property and a distinct properly formatted read secret.
* Validates the exact 11-column Events and 14-column Packages header schemas and bounded display values (maximum 4,000 rows). No arbitrary range, private booking tab, hidden sheet or mutation action is accepted. Failure returns one fixed generic JSON denial.
* Successful JSON envelope matches the existing Vercel `server/core-sheet-apps-script-reader.js` expected response, including the original requested range, rows and source ID. An Apps Script ContentService redirect must be validated server-side; **never embed any read key in a redirect URL**.

## Acceptance matrix / HOLD

| Test | Must show |
| --- | --- |
| Offline unit/contract | Node VM executes the actual GAS staging source; incorrect ACL, token, workbook, sentinel, schema and action fail closed |
| Offline Vercel integration | The actual private reader and public-data endpoint consume only synthetic Events/Packages through the validated Google redirect; no GViz fallback |
| Staging provider proof (still required) | Native Apps Script URL, exact immutable source version and bound workbook verified; HTTP 200 for both feeds and safe 503 on denied access |
| Business parity (still required) | Separate *private* owner comparison of live displayed event/stock/prices before any production ACL change, with rollback |
| Booking/LINE (not in this reader) | Full synthetic Core booking schema, real **isolated** canonical GAS writer, signed customer/owner provider UAT, original durable Outbox contracts, reviewer approval |
| Production release (HOLD) | Private Core migration/canary/rollback passes, reviewer APPROVED on exact HEAD, owner approves production cutover |

**Hard prohibition:** This isolated reader does not justify changing Core file sharing, adding private Outbox rows into a public Core, connecting a real LINE carrier, or merging/deploying PR #875. The existing canonical production workbook and Vercel main are unchanged by this staging source.

## Rollback

No production rollback is necessary from a source-only/staging fixture exercise. To disable an actual staging deployment, set `KK_STAGING_PRIVATE_READ_ENABLED=0`, rotate/revoke its dedicated read key, and disable the staging Preview binding. Keep the workbook owner-private, preserve failed-request diagnostics without secrets, and confirm no real booking/outbox writes. Do not retry a delivery in an `UNCERTAIN` state.

## Evidence and cross-chat

Use Issue #861 for **sanitized** commit/CI/status, and the existing owner-private Engineering History & UAT Log for the staging workbook URL, deployment identifier/owner, ACL evidence and real provider readback. Never claim this README alone means the script is deployed or LINE Card is production-ready.
