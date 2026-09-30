# Verifier no-drop reconciliation hardening — 2026-09-23

## Incident

The October Event Tracker had a visibility gap even though discovery had succeeded.

GMMTV FANIVAL 2026 : Happy Family was discovered for all 13 days (1–13 Oct 2026) and staged as 13 Candidate rows plus 13 AI Inbox work packets. The Candidate rows remained READY_FOR_VERIFIER and the AI packets remained READY_FOR_VERIFIER, but the visible October monthly sheet had no FANIVAL row.

Separately, Core/Admin had created storefront events for 1–11 Oct. That produced a real three-surface divergence:

- Scanner/AI discovery: 13/13 days
- Tracker monthly visibility: 0/13 before repair
- Core/storefront: 11/13 days before repair

The Candidate schema has no Work Packet ID column. Work Packet ID and Packet Status live in _AI_Inbox. A verifier selector that treats Candidate as the work-packet anchor can therefore starve valid packets.

## Runtime contract repair

Machine SOT policy v4.9.31 makes these invariants explicit:

1. Operational READY packets are anchored in _AI_Inbox: nonblank Work Packet ID + Packet Status=READY_FOR_VERIFIER.
2. Candidate is joined by exact Show ID, falling back only to exact Event Family ID + exact event date with exactly one match.
3. Zero/multiple matches are explicit pairing debt, never a silent skip and never fuzzy identity matching.
4. Multi-day families require complete disposition accounting across every discovered day.
5. Core-present + Tracker missing is a reverse Core orphan.
6. Tracker-discovered + Core-missing is Core-promotion debt.
7. Candidate/AI terminalization must be mutually consistent after packet-level COMMIT/HOLD.
8. Scanner remains staging-only. Verifier may repair Tracker canonical/monthly state only. Core backend createEvent/package/poster/price remains a separate governed Admin action.

The existing Orchestrator and Daily Closure automation IDs/cadence were preserved and their prompts were upgraded in place to v4.9.31.

## FANIVAL bounded repair

Owner-authorized Verifier repair:
- Run: GPTV431-20260923T152225-OWNER-NODROP-FANIVAL-REPAIR
- Transaction: TX|FANIVAL|V431-NODROP-RECON|20260923T152225
- CORE lease: v44
- VERIFIER lease: v284
- Manifest: MANIFEST|VERIFIER|20260923T152225|OWNER-NODROP-FANIVAL-REPAIR

Readback after commit:
- October monthly family visibility: exact 1 HOLD row covering 1–13 Oct
- Event Lifecycle: exact 1 family HOLD/WATCHING row
- Explicit Core lineage: exact 11 mappings for 1–11 Oct
- Explicit Core-promotion debt: exact 2 rows for 12–13 Oct
- Candidate daily packets: exact 13 retained operational
- AI Inbox daily packets: exact 13 retained operational

Family accounting is therefore 13/13 without fabricating the missing Core events.

No Core backend event, package, poster, price, booking, inventory, outbound notification, Apps Script deployment, Make mutation or final rental price was written by the repair.

The 15:00 scheduled task on 2026-09-23 had no governed Run_Lock/Run_Manifest evidence by 15:12. It receives zero natural-runtime acceptance credit. The owner repair is recorded separately and is not relabeled as the missed natural occurrence.

## Repository guard

server/verifier-no-drop-reconciliation.js provides a zero-write deterministic contract for:
- AI Inbox READY selection
- exact Candidate pairing
- pairing-debt detection
- reverse Candidate READY audit (Candidate READY with no AI packet, or Candidate READY after its AI packet terminalized)
- multi-day family completeness accounting
- reverse Core orphan detection

tests/verifier-no-drop-reconciliation.test.js contains regression fixtures including the 13-day FANIVAL / 11-day Core case.

The verifier skill now documents the same packet anchor, exact join, family completeness and reverse reconciliation rules.


## 2026-09-28 reverse-Candidate finding

A live audit found 26 Candidate rows with `Status=READY_FOR_VERIFIER` while the operational AI queue had 19 packets with nonblank `Work Packet ID` and `Packet Status=READY_FOR_VERIFIER`. Exact Show ID reconciliation proved the 19 operational AI packets had Candidate pairs, while seven Candidate READY rows had no AI packet at all.

The seven Candidate-only rows are explicit `CANDIDATE_READY_ORPHAN_NO_AI_PACKET` debt. They are not operational Verifier packets and must not inflate the AI-anchored READY backlog. The repository guard audits this reverse direction deterministically so Candidate-only orphan/stale-ready drift is visible instead of silently surviving closure.

This hardening is zero-write: it does not fabricate missing AI work packets, fuzzy-match identities, or mutate production business truth.
