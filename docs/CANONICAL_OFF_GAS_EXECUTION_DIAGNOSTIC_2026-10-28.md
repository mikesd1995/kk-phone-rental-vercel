# Canonical OFF private GAS execution diagnostic — 28 October 2026

Status: SOURCE_PREPARED_AND_TESTED; not released or runtime-executed.

## Problem and resulting behavior

The existing readiness-v1 route deliberately checks configuration without Google IO. Operational canonical functions require enable flags and may claim or project rows; they must not be invoked to test owner OAuth while senders are OFF. A new authenticated gas-health-v1 diagnostic on the same gateway permits only one OAuth refresh and one fixed private API execution of the already-deployed getCoreV1NotifierHealth function.

The five request fields are stage=canonical-gas-health, version=v1, nonce, bot_id and provider_binding_sha256. The exact header selects the diagnostic. Existing consumer authentication, complete binding and all three OFF flags are required before IO. The known Script project and private deployment are pinned; callers cannot choose a URL/function/project/deployment/scope/parameters/token.

The only private request is getCoreV1NotifierHealth with parameters=[] and devMode=false. Runtime tokens remain inside the existing server secret store/closure; no values or raw Google errors are returned. Requests/responses/deadlines are bounded (refresh request32KiB, each JSON response16KiB, combined10seconds), redirects forbidden and no retry. Only typed safe health booleans/counts/known handlers/constant tab are returned; raw send_not_before is omitted. The timestamp validator accepts valid legacy RFC3339 formats while independently rejecting invalid calendar values. Enabled transport/UAT health fails closed.

The old configuration readiness remains zero IO. Canonical operational functions, sender flags, adapter capture manifest, source age/TTL, database, GAS source, Make graph/schedule and storefront are unchanged.

## Live boundaries verified before source preparation

- Actual Edge v6 source is pre-canonical: exact LF hash e11308449f6a2ee6052ccd2d28e1ed64716158aca5b8e39df1d12de83c481e3b matches ancestor a5514d647f60777de14a83a9da451d04a057ce2c and lacks the canonical v2 handler/RPC. Approved source Edge hash is88d8c0116201e32df8ac76a409d61f309bea3ea855b383597ebd6c1f7efde60f. This source work does not deploy it.
- Actual private API remains Version1/MYSELF at the existing pinned deployment. Version1 canonical code LF hash8a1d7dfde3122c61ce23cb344c34d51b4868259637a165aa75eedd37ad70bb72 equals approved source. Version1 core equals Code.gs LF + one LF + OwnerLedgerBridge.gs LF (hash0e55fbf6d32846418f91cecc708bd7d9de385432909e8a80773d77c5a1ed850d). Health function exact LF hashf26a5e6f136199e124203490b13f589ec31babc5e9aeb7a440b2bf11b88695dc matches source. No GAS edit/deploy/run was needed for this parity check.
- Make6176241 is inactive/on-demand/provider8/11/12/13OFF. SDK11956776 is bound and installed app communications/interfaces match source, but canonical11/12/13 remain orphan/no input mappers. HTTP11963582 exists but main6/9 remain original noAuth. The diagnostic does not treat structural metadata as runtime binding or repair the canonical graph implicitly.

## Retrieval regression repaired

Adding the gateway hook increased estimated context by123tokens, causing greedy12k allocation to drop the late curated Edge path. Holding imports constant and restoring only the old file size reproduced/reversed the defect. The allocator now reserves useful256-token targeted slices for remaining curated files of the highest positive-priority route, within the existing12k/10file limits. Priority0 route behavior and acceptance thresholds remain unchanged. A new source-growth regression covers the omission and file caps.

## Verification and release boundary

New diagnostic plus old readiness tests28/28; Code Intelligence18/18; routed owner-ledger suite387/387; checked-in23case benchmark100% route/required-file recall, zero false positives, max12k/8files. Final full suite2442/2442 plus separate poster ACL29/29 passed, no skips/failures. Independent review additionally exercised tiny budgets/file caps/missing files. Initial two retrieval failures are retained as red evidence rather than waived.

These are source/local-test results. Actual OAuth refresh, fixed private GAS execution, SDK/HTTP authenticated diagnostic readbacks, Edge canonical installation and natural runtime remain unverified until separately approved release and fresh readback. A current exact-source owner release decision is required; the old #793 head does not approve this new diagnostic source.

## Proposed finite OFF verification after exact-source approval

Refresh SOT/policy, deployment, native empty cutover, Make flags and binding first. Release the reviewed gateway source and approved Edge file through existing governed paths, keeping all flags OFF. Use only a bounded temporary diagnostic on existing Make6176241 with existing SDK/HTTP credentials; do not alter main6/9 or call send/report/poll/claim. Verify only the selected diagnostic module executes and restore the exact prior graph immediately after finite tests. Read back OFF state and no new native/Sheet/provider writes. No credential export, new OAuth consent, alternate runner, old fixture/replay or Scanner/Verifier activation follows.

