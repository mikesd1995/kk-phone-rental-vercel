# KK Phone Rental — Poster uploader public-Reader guard (14 October 2026)

**Status:** STAGED SOURCE ONLY, NOT DEPLOYED, NOT MERGED, NOT A REPAIR OF EXISTING FILE ACLS.

## Why this is necessary

The owner-connected Google Drive audit reports **33/33 current storefront Drive image files** and **4/4 scoped Brand/Posters/Brand Kit folders** with `type=anyone,role=writer`. This is live risk; neither a new user Reader grant nor a new app feature safely downgrades the existing Anyone Writer grants.

A non-Booking source review of `apps-script/Code.gs` found two **false-positive publication acceptance paths**:
1. `file.setSharing(ANYONE_WITH_LINK, VIEW)` returned without a provider role readback. A successful call does not prove the final effective role is Reader.
2. `kkDrivePermissionApiSetAnyone_` treated HTTP 409 from `permissions.create(type:anyone,role:reader)` as OK. A 409 can mean a permission already exists, including an existing Writer grant. It does not prove Reader.

These are **plausible causes of silent misreporting**, not proof of why the current 33 files are Writer. The exact live deployed Apps Script version has not been independently matched to this repository file.

## Changes in source-only branch

Branch `fix/poster-uploader-reader-verify-20261014`, based on production-main commit `d6dc3bfe4cc0c4dd6fdfec407823752da0572464`.

- Add `kkVerifyDriveAnyoneReader_` which reads `Drive API permissions.list` with authenticated existing Apps Script token and checks a complete permission listing for **exactly one Anyone permission with role Reader**. It also checks `DriveApp.getSharingAccess/getSharingPermission` for the effective `ANYONE_WITH_LINK/VIEW` state. Any disagreement or inaccessible/incomplete response fails closed.
- `kkDrivePermissionApiSetAnyone_` must confirm final Reader after a 2xx or 409 response, rather than accepting 409 alone.
- `kkEnsureDriveFilePublic_` must read back after `setSharing` before `public_checked:true` is returned.
- `kkNormalizePoster_` now rejects **owner-pasted existing Drive poster URLs** when `ensurePublic` is requested but the referenced Drive file's effective Reader ACL is not verified. Empty poster values and non-Drive external URLs still preserve their existing behavior.
- `kkApiUploadPoster_` refuses to create a file when the configured poster parent folder is not already `ANYONE_WITH_LINK/VIEW`. After creation it rejects an unverified file instead of returning a poster URL. This is an intentional availability-versus-security tradeoff until the existing folders are correctly remediated.

**Shared source isolation:** Source-by-function diff against exact main shows **only** four poster-related functions modified: `kkDrivePermissionApiSetAnyone_`, `kkEnsureDriveFilePublic_`, `kkNormalizePoster_`, `kkApiUploadPoster_`; one added function `kkVerifyDriveAnyoneReader_`. Other **161 pre-existing function definitions, including Booking functions, are source-identical**. The branch has not been deployed or executed against Booking or customers.

## Test and release gates

Test file `tests/kk-poster-upload-reader-acl.test.cjs` contains **16 offline provider-mock contracts**:
- Successful Reader readback and normal poster URL
- Drive permission POST 409 with existing Writer
- `setSharing` success masking Writer
- API Reader versus effective DriveApp EDIT disagreement
- Duplicate Anyone grants; incomplete/paginated listing; HTTP read failure
- Failure fallback when actual readback is Reader
- Public Writer/private parent folder **must block before file creation**
- Unverified child ACL **must not return a successful poster URL**
- Owner-pasted existing Drive URL with Writer is rejected; verified Reader works
- Empty poster stays empty; an external non-Drive poster URL is not subjected to Drive permission mutations

**Executed:** 16/16 exact fetched-source callbacks PASS in isolated V8 with mocked Node and provider APIs. This is **not** `node --test`, Google-native permission API tests, GitHub Actions CI or production acceptance. Source compiles as JS.

Recommended free offline check when runnable: `node --test tests/kk-poster-upload-reader-acl.test.cjs`. Do not spend to re-run blocked GitHub Actions repeatedly. Before even considering a deployment, validate live owner-authorized Apps Script scopes, safe failure UX, parent ACL fix, actual uploader Reader readback, and correct signed-out delivery; preserve owner approval and rollback. **No automatic deploy/merge.**

## Distinct required real work

**Existing files:** [Security Issue #718](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/718) and [Draft #721](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/721) remain the governed owner-only historical ACL remediation. The connected Drive tool cannot edit existing Anyone grants. The owner must run reviewed Apps Script Dry Run/approved Apply, then independently re-read 33 active file roles + 4 folder roles and verify 41 guest thumbnail URLs. Historical/hidden/private items must not be unintentionally exposed or modified.

**Missing official artwork:** [Issue #731](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/731): nine future-visible events still lack pixel-verified, durable official artwork. FORTREASURE owner's real 800×1132 original prints **29 NOVEMBER 2026**; the **27 NOVEMBER** Core card is blank and must not reuse the 29-Nov-only poster. LE7EL 15-Oct organizer announcement is https://www.instagram.com/p/DeI70CVTFrr/ but its signed IG image URL is transient and not an approved long-lived storefront asset.

**No Booking reads/writes/functional modifications; no user-customer data edits, no price/availability changes, no new paid services, no production or preview deployment.**
## Latest source/test head
- Added existing Drive URL source guard at `kkNormalizePoster_`, plus 4 offline regression cases; current isolated V8 exact-source mock acceptance **16/16 PASS**. A source-by-function comparison confirms **161 unchanged legacy functions**, 4 changed poster-only functions, and 1 added Reader-verify helper. No Booking functions changed; no production update occurred.
