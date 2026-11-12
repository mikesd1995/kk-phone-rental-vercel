# KK Phone Rental — Admin Operations R15 source verification gate (2026-11-10 ICT)

Status: SOURCE-ONLY STAGED / RELEASE HOLD / NOT LIVE.

Independent source audit of parent #851 and child #857 revealed that a source can be stale (>180 seconds) or from public GViz fallback and still populate phoneReady/bundleReady=true when package numbers are positive. The UI then displays "พร้อม N เครื่อง" despite a gate that only blocks X drafts. Also Web Ready missing an event date silently falls back to Core and can be falsely regarded as independently verified.

This branch is based on exact child #857 SHA `886140fdcf34303f469db4011935ba32f433cae7`; it never writes into #851, #854, #857, main, Vercel Production, Google Sheets, Bookings, secrets, ACLs or X.

Changes:
1. Readable rows remain visible for audit but phoneReady and bundleReady are forced false if generated_at is stale/invalid or fallback reader is public GViz; add a source-uncertainty QA group.
2. Require independently provided Web Ready event date to match Core/ID; no silent Core fallback for a rent-ready claim.
3. Keep QA wording accurate when stock itself is positive but source is not verified.
4. Four focused unit regressions: stale private, fresh public fallback, missing Web Ready date, and valid fresh/private positive control.

Exact-head GitHub Actions CI, registered eight-viewport UX, independent reviewer, hosted signed Admin with *real* private source, source parity, no customer PII, and merged-tree exact SHA / rollback remain mandatory before any Production release. Synthetic #854 must NOT be merged for Production.

Next: verify exact-head CI, request genuine independent reviewer, integrate candidate fixes into an approved merged tree based on current main and perform real-source hosted readback. Do not self-approve or bypass protection.
