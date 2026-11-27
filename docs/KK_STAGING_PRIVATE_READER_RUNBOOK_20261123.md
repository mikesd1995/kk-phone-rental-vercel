# KK Phone Rental — Isolated GAS Private Reader Staging (2026-11-23)

## What this does / does not do

This is an intentionally **read-only**, **synthetic-only** Google Apps Script Web App source: `apps-script/staging/Code.gs`. It is **not** `apps-script/Code.gs`, must not be pasted into production GAS, and has **no** booking writer, terms acceptance, outbox claim, LINE reply/push, or production cutover logic. Source and offline contract tests are not proof of an actual published GAS version.

The real owner-only synthetic Google Sheet ID and exact access details are held in the private owner Engineering History & UAT Log; **never put that ID, a reader secret, or any real LINE U-ID in this repository, GitHub Issues, test snapshots or browser code**.

## Manual, separate GAS-bound staging deployment (not yet performed)

1. Open the existing **synthetic staging workbook**, not the canonical Core or a customer-filled copy. Confirm Drive shows only the owner permission; both outbox tables must still be header-only.
2. From that staging spreadsheet's **Extensions → Apps Script**, create or open its **own distinct container-bound script**. Verify editor project/owner and actual bound spreadsheet. Never reuse the canonical GAS project's Script ID or deployment.
3. Paste *only* the file `apps-script/staging/Code.gs`. Do not paste the full `apps-script/Code.gs`; they both implement `doPost` and are incompatible in one deployment.
4. In the staging script's Script Properties, set **only staging-specific values**: `KK_STAGING_SHEET_ID` to the private staging ID, `KK_STAGING_PRIVATE_READ_ENABLED=0`, and `KK_CORE_PRIVATE_READ_KEY` to an owner-generated fresh random base64url secret (at least 32 characters). It **must differ** from `KK_ADMIN_API_KEY`, any production read key, any LINE key and all dispatcher secrets. Never record secret values in documents/logs. Locally use `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` on a trusted operator machine.
5. In the bound staging **editor**, run `kkStagingBindFromEditor` once while the read flag is `0`. Approve the requested Google permissions directly in the owner account. It verifies the active parent ID, owner-private ACL and sentinel, and records `KK_STAGING_VERIFIED_BINDING` for the current Script ID and Sheet ID. Never fill this property manually or copy it from another project. Confirm the returned `binding_verified:true`; then set `KK_STAGING_PRIVATE_READ_ENABLED=1`. Binding errors must stop deployment, not be bypassed.
6. Deploy a **new immutable staging Web app version**, executing as the script owner. The Vercel server will invoke it over HTTPS as a machine caller; if provider access must be set to "Anyone", the long one-purpose request key, exact allowlist, owner-private ACL and staging sentinel are mandatory. The script intentionally provides no GET endpoint; if unauthorized requests return only a generic denial, do not treat this as proof of user authentication. Record only version/deployment identifiers, no secret.
7. Do **not** change production Vercel environment variables. For an explicitly isolated staging Preview only, bind `GOOGLE_SHEET_ID` to the synthetic workbook, `KK_CORE_SHEET_REQUIRE_PRIVATE=1`, `KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1`, `KK_CORE_PRIVATE_TRANSPORT=apps-script`, `KK_ADMIN_SCRIPT_URL` to the staging `/exec`, and `KK_CORE_PRIVATE_READ_KEY` to that staging-only secret. Disable native LINE booking, outgoing messages, booking mutations and all other real provider integrations. Avoid preview fixture overrides hiding an unconfigured reader.

## Exact source contract

* Accepts only POST action `privateCoreRead` with the staging sheet ID, valid read key, `08_Web_Ready!A4:K` or `09_Web_Packages!A4:N`.
* The editor-only binding step verifies `SpreadsheetApp.getActiveSpreadsheet().getId()` while disabled. Google documents that bound active-parent methods are unavailable during Web App execution: https://developers.google.com/apps-script/guides/bound#special_methods . The `/exec` runtime requires the owner-attested binding, exact current `ScriptApp.getScriptId()`, matching request ID, and enabled flag before opening only the configured ID via `SpreadsheetApp.openById()`. Each read still checks owner-only ACL, synthetic sentinel, schema/content, and the distinct read secret. The HTTP dispatcher has no binding action. Script properties are owner-controlled; this is not independent provider proof of the bound parent.
* Validates exact 11-column Events and 14-column Packages header schemas and bounded display values (maximum worksheet row 250). Reads require at least one explicitly synthetic event/package row: IDs `EVT-YYYYMMDD-SYNTHETIC-*` and `PKG-STAGING-*`, no duplicate IDs. Rejects copied live IDs, unexpected package types, legacy `LENS_200` / `LENS_400` aliases, X300 + 400mm mismatch, arbitrary range, private booking tab, hidden sheet or mutation action. Failure returns one fixed generic JSON denial.
* Successful JSON envelope matches the existing Vercel `server/core-sheet-apps-script-reader.js` expected response, including the original requested range, rows and source ID. An Apps Script ContentService redirect must be validated server-side; **never embed any read key in a redirect URL**.

## Canonical package enums (synthetic fixtures only)

The owner-private staging workbook's five **fabricated** storefront rows were reconciled against production **header and enum shape only**, with no customer or booking data transferred. Valid published combinations are:

| Model | `package_type` | `lens_group` |
| --- | --- | --- |
| vivo X300 Pro | `phone_only` | `NONE` |
| vivo X300 Pro + Lens 200mm | `phone_lens_bundle` | `ZEISS_2_35X` |
| vivo X500 Pro Max | `phone_only` | `NONE` |
| vivo X500 Pro Max + Lens 200mm | `phone_lens_bundle` | `ZEISS_2_35X` |
| vivo X500 Pro Max + Lens 400mm | `phone_lens_bundle` | `ZEISS_400MM` |

Do not use `phone_lens_200`, `phone_lens_400`, `LENS_200`, `LENS_400`, or `confirmed`/`cancelled` as source sheet event status in these fixtures. They do **not** match current canonical enums. The synthetic `01_Events.event_status` rows use `open` / `closed`. Synthetic prices are NOT production prices. These static rows are not inventory formulas or a live booking acceptance test.

**Synthetic CONTENT gate (not just synthetic IDs):** A row labeled `EVT-*-SYNTHETIC-*` or `PKG-STAGING-*` is NOT sufficient evidence that its contents are fake. The isolated GAS reader additionally matches two exact fabricated event identities/names/dates, fixed `SANDBOX TEST HALL` venue, empty poster, synthetic-only note and message, bounded stock counts, and all five fixed package IDs, model/lens display strings, `SYNTHETIC PRICES — NOT LIVE` note, `TEST ONLY` use case, nonnegative bounded prices and stock. If any field is replaced with real customer text, the WHOLE read fails closed before responding with rows. No live booking/contact, identity, poster URL or internal note may ever be copied into this fixture. Changes to synthetic fixture identity or fixed labels require a reviewed source-and-test change; do not loosen checks solely to obtain a green response.

Google Sheets connector displayed-value reads can represent an empty cell as `null`, whereas Apps Script `getDisplayValues()` returns `''`. Test provider output using the actual bound GAS readback after deployment; the connector parity read is not proof that a deployed Web App returns that data.

## Acceptance matrix / HOLD

| Test | Must show |
| --- | --- |
| Offline unit/contract | Node VM executes the actual GAS staging source; incorrect ACL, token, workbook, sentinel, schema and action fail closed |
| Offline Vercel integration | The actual private reader and public-data endpoint consume only synthetic Events/Packages through the validated Google redirect; no GViz fallback |
| Staging provider proof (still required) | Native Apps Script URL, exact immutable source version and editor binding verified; real `/exec` returns valid JSON for both feeds, fixed denial on wrong key/ID, and strict Vercel endpoint returns 503 on denied access |
| Business parity (still required) | Separate *private* owner comparison of live displayed event/stock/prices before any production ACL change, with rollback |
| Booking/LINE (not in this reader) | Full synthetic Core booking schema, real **isolated** canonical GAS writer, signed customer/owner provider UAT, original durable Outbox contracts, reviewer approval |
| Production release (HOLD) | Private Core migration/canary/rollback passes, reviewer APPROVED on exact HEAD, owner approves production cutover |

**Hard prohibition:** This isolated reader does not justify changing Core file sharing, adding private Outbox rows into a public Core, connecting a real LINE carrier, or merging/deploying PR #875. The existing canonical production workbook and Vercel main are unchanged by this staging source.

## Rollback

No production rollback is necessary from a source-only/staging fixture exercise. To disable an actual staging deployment, set `KK_STAGING_PRIVATE_READ_ENABLED=0`, remove its verified binding if retiring the staging project, rotate/revoke its dedicated read key, and disable the staging Preview binding. Keep the workbook owner-private, preserve failed-request diagnostics without secrets, and confirm no real booking/outbox writes. Do not retry a delivery in an `UNCERTAIN` state.

## Evidence and cross-chat

Use Issue #861 for **sanitized** commit/CI/status, and the existing owner-private Engineering History & UAT Log for the staging workbook URL, deployment identifier/owner, ACL evidence and real provider readback. Never claim this README alone means the script is deployed or LINE Card is production-ready.

## Zero-cost owner authentication route

Use the existing synthetic workbook's Extensions → Apps Script editor, not a second parallel production backend. Alternatively, after the owner has created the separate bound project, the official `clasp` CLI can clone/edit/version it with owner-granted OAuth and the Apps Script API enabled (https://developers.google.com/apps-script/guides/clasp). Use a trusted owner-controlled machine, check the project ID before any write, and keep all OAuth/token files out of Git, chats and logs. A browser session or read-only Sheets connector does not grant this authorization. No deploy is claimed until actual versioned `/exec` readback; do not use a forced push against any existing canonical project.
