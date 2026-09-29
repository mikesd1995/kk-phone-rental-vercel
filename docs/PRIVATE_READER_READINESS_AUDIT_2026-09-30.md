# Private Reader Readiness Audit — 2026-09-30

## Scope
Private Reader only. No Scanner run, pricing change, poster change, workbook privacy change, service-account secret write, or business-data mutation is performed.

## Production baseline
The live public event feed returns:
- HTTP 200
- `Cache-Control: no-store, max-age=0, must-revalidate`
- `X-KK-Sheet-Config: env`
- `X-KK-Sheet-Source: public-gviz-fallback`

Therefore Production has **not proven private-service-account reads**. Strict private mode must remain disabled and the workbook must remain publicly readable until private acceptance succeeds.

## Existing private-reader contract confirmed
- OAuth scope is `spreadsheets.readonly` only.
- Service-account JWT uses RS256 and Google OAuth token exchange.
- private read uses Sheets API `values.get` semantics.
- credentials are never returned to clients.
- `KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1` disables public fallback.
- strict mode reports `private-not-configured` or `private-read-failed`.
- optional migration mode reports `public-gviz-fallback-after-private-error` when credentials exist but private read fails.
- public boundary remains restricted to `08_Web_Ready` and `09_Web_Packages` allowed ranges.
- event/package schema validation remains mandatory after either reader.

## Finding: Sheet-ID split-brain risk
The public proxy selected `GOOGLE_SHEET_ID`, while the private helper defaulted to `KK_CRM_SHEET_ID`.

If both variables existed with different values, the two reader paths could target different workbooks. That makes a private cutover unsafe because reader-source success alone would not prove SOT identity parity.

## Hardening
1. Add canonical Sheet-ID resolver in the private helper.
2. Accept either env name when only one is configured.
3. If both are configured, require exact equality.
4. A conflict is classified `CRM_SHEET_ID_CONFLICT`.
5. Public API now fails closed with HTTP 503 and `X-KK-Sheet-Source: sheet-id-config-conflict` instead of choosing one side silently.
6. Continuous invariant gate now protects the canonical Sheet-ID rule.

## Cutover acceptance gate
Do **not** set `KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1` and do **not** make the workbook private until all are true on Production:
1. credentials are configured read-only;
2. both `08_Web_Ready!A4:K` and `09_Web_Packages!A4:N` return HTTP 200;
3. both responses report `X-KK-Sheet-Source: private-service-account`;
4. schemas match the current public contract;
5. representative row counts/identities match the public reader during migration;
6. public-data redaction and no-store invariants still pass;
7. only after that, enable strict private mode and rerun runtime acceptance;
8. only after strict-mode acceptance may public workbook access be removed.

## Safety
Production writes: 0.
Business-data mutations: 0.
Vercel environment mutations: 0.
Workbook ACL mutations: 0.
Secrets printed: 0.
