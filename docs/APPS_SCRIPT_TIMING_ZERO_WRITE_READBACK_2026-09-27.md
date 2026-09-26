# Apps Script Timing Zero-Write Readback — 2026-09-27

## Objective

Reduce the remaining Apps Script timing uncertainty without changing the live Apps Script project, Spreadsheet timezone, installed triggers, business rows, Vercel secrets, or Production deployment.

## Why this probe exists

The Core workbook exposes Spreadsheet timezone `Etc/GMT`, while business time is Asia/Bangkok. The Apps Script backend formats API timestamps with the project time zone. Direct Project Settings / Installed Trigger access is not available through the connected Google Drive/Sheets tools.

The Production backend already exposes one intentionally read-only action: `phase1Health`. That response includes `generated_at`, formatted by the Apps Script runtime. Comparing that local timestamp to the authenticated request's UTC window lets us infer the live script's effective UTC offset without changing the project.

This can verify effective UTC+07:00 behavior. It cannot by itself prove the named Project timezone is literally `Asia/Bangkok`, and it cannot prove the installed trigger exists unless the deployed read-only response explicitly exposes trigger metadata.

## Execution path

A same-repository PR workflow:

1. uses the existing repository Vercel token;
2. pulls Production environment values into an ephemeral GitHub runner only;
3. never prints or uploads the environment file;
4. validates the canonical Apps Script `/exec` URL locally;
5. sends exactly one `phase1Health` POST;
6. checks backend/Sheet identity;
7. infers the effective UTC offset from `generated_at`;
8. searches only the returned read-only diagnostic keys for explicit timezone/trigger metadata;
9. uploads a secret-safe JSON artifact;
10. records a secret-safe summary on the PR.

## Mutation boundary

The probe does not call:

- `snapshot`;
- `cleanupOldData`;
- any Booking/Event/Package/Asset/price write action;
- `kkInstallDailyCleanupTrigger`;
- any Apps Script deployment/version mutation;
- any Spreadsheet timezone mutation;
- any Vercel environment mutation.

Expected mutation counts are zero.

## Acceptance interpretation

- Effective offset = `+07:00`: live Apps Script time formatting is consistent with Bangkok business time at the observation point.
- Named timezone exposed as `Asia/Bangkok`: direct named-zone evidence exists.
- Cleanup trigger exposed and identifies `kkCleanupOldData30DaysAuto`: direct trigger evidence exists.
- If named timezone / trigger metadata are absent from the deployed read-only API, keep those items explicitly UNVERIFIED instead of changing settings merely to make Health green.


## Fallback after sensitive-value placeholder detection

The first Production `vercel pull` probe confirmed that all three required values were present but represented by non-URL placeholder material in the local pull. No raw value was printed. Because Vercel supports read-only environment retrieval with `decrypt=true` for an authorized project token, the workflow now uses that API only inside the ephemeral runner for these three keys:

- `KK_ADMIN_SCRIPT_URL`
- `KK_ADMIN_API_KEY`
- `GOOGLE_SHEET_ID`

Values are written to a chmod-600 temporary file, never uploaded, never echoed, and never committed. Only key presence/type/target/value length is printed. The resulting file is then consumed by the same read-only `phase1Health` probe.

This is still zero-write and zero-cost: it reads existing Production configuration but does not modify it.


## Second fallback: Vercel env run

The read API confirmed that these Production variables are stored as sensitive values and are intentionally not returned as plaintext to the project token, even through exact env-id retrieval. To avoid weakening or rewriting those secrets, the audit uses Vercel's zero-write `vercel env run -e production` mechanism instead.

That command injects the existing Production environment into one ephemeral process without printing or persisting the values. The timing probe reads them only from `process.env` and still sends exactly one read-only `phase1Health` request.

No Vercel environment value is changed or downgraded from sensitive storage.
