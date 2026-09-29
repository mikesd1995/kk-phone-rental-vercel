# Owner Visibility Tombstone Hardening — 2026-09-29

## Problem

Owner-hidden events were able to reappear after Ultra Deep / Full Loop / rescoring jobs wrote `01_Events.active_on_web=TRUE` directly.

Confirmed historical incidents include:
- Manutsawee and Young K: Ultra Deep sync overwrote owner-hidden Core visibility.
- Hwang In Youp and GMMTV FANIVAL 11 Oct: later reconciliation had to restore owner-closed state.
- ZeePruk and LANDOKMAI 11 Oct: score-qualified rescoring published them even though the owner later required every 11 Oct event except The Weeknd to remain hidden.
- NuNew 31 Oct: historical owner-hidden state existed, but current Core was TRUE while all packages were hidden. After the storefront policy changed to keep all-hidden packages visible as full/waitlist, the card could reappear.

The existing owner-visibility guard was correct on guarded Admin/Apps Script/direct-writer paths, but it was not durable against raw Google Sheets/batch writes and did not persist event identity after a Core row was deleted.

## Production data-plane changes

Created `18_Event_Visibility_Locks` as persistent history/tombstone SOT with:

- `LOCKED`: owner-hidden; explicit owner reopen required.
- `REOPENED`: previously owner-hidden and explicitly reopened; history retained.
- `SEEN_CORE`: event has existed in Core; rediscovery after deletion is reconciliation/history debt, not a new auto-publish candidate.

Backfill at 2026-09-29:
- 171 current Core identities recorded.
- 20 LOCKED.
- 1 REOPENED: Young K, based on the owner's explicit 2026-09-29 reopen.
- 150 SEEN_CORE.

NuNew 31 Oct was repaired from unauthorized `active_on_web=TRUE` to FALSE.

The current 11 Oct owner decision is recorded persistently:
- The Weeknd remains visible and is not LOCKED.
- GMMTV FANIVAL, ZeePruk Happy Birthday Day and LANDOKMAI SPECIAL SHOW are LOCKED and hidden.

## Storefront fail-closed formulas

Live production formulas were hardened in:
- `08_Web_Ready!J5:J1000`
- `09_Web_Packages!J5:J1000`

They now fail closed when:
1. current `event_id` is LOCKED;
2. normalized event identity is LOCKED; or
3. the same name/date/venue identity exists in history under a different event ID.

Rule 3 prevents a raw/batch writer from bypassing history by generating a new event ID.

Existing current events are not hidden merely because they are `SEEN_CORE`: the different-ID condition only triggers on recreation.

## Production bypass acceptance probe

A deliberate raw Google Sheets bypass probe was executed against owner-hidden NuNew:

1. NuNew Core `active_on_web` was temporarily forced to TRUE by direct batch write.
2. The persistent tombstone remained LOCKED.
3. `08_Web_Ready` remained `hide`.
4. All NuNew `09_Web_Packages` remained `hidden`.
5. Core was restored to FALSE immediately after the probe.

Result: PASS. A raw Core visibility overwrite can no longer expose a LOCKED event on the storefront.

## Control-plane hardening in repository

### event-visibility-owner-guard

Added persistent history resolution by exact event ID and normalized event name/date/venue.

New outcomes:
- `EVENT_VISIBILITY_TOMBSTONE_LOCKED`
- `EVENT_HISTORY_RECREATE_PROHIBITED`
- `OWNER_REOPEN_CONFIRMED_TOMBSTONE`

### Admin API

Create-event preflight now loads `18_Event_Visibility_Locks`.

After the normal current-Core duplicate check:
- LOCKED historical identity → reject create.
- SEEN_CORE / REOPENED historical identity → reject create and require reconcile.
- New identity with no history → normal governed create path.

Visibility preflight also runs for explicit reopen so the persistent lock is evaluated instead of bypassed.

### Direct Google writer

`updateEvent` now reads and writes the visibility lock in the same atomic Google Sheets batch:
- owner hide → event FALSE + lock `LOCKED`;
- explicit owner reopen → event TRUE + lock `REOPENED`.

A LOCKED tombstone blocks an automatic reopen even if another raw writer has already corrupted Core to TRUE.

### Apps Script canonical source

The repository canonical source now:
- knows `18_Event_Visibility_Locks`;
- creates/repairs lock-sheet headers;
- blocks historical event recreation;
- writes `SEEN_CORE` for every newly created event;
- writes `LOCKED` on event hide;
- writes `REOPENED` only on explicit owner reopen;
- contains canonical Web Ready/Web Package tombstone formula generators.

Important deployment note: repository `apps-script/Code.gs` remains a hardened source lineage and is not proof of the currently deployed Apps Script bytes. The live protection in this incident is already enforced by the production Sheet SOT/formulas independent of a new Apps Script deployment.

### Scanner and Verifier

Scanner now treats any history hit as EXISTS / RECONCILE / HOLD_OWNER_HIDDEN, never NEW_AUTO_PUBLISH.

Verifier promotion now blocks:
- current Core event → reconcile existing event, never create another;
- LOCKED history → OWNER_HIDDEN_RECREATE_PROHIBITED;
- SEEN_CORE / REOPENED history with no current Core row → HISTORICAL_EVENT_RECREATE_PROHIBITED.

A regenerated event ID is not an escape hatch.

## Intended authority contract

| State | Ultra Deep / Scanner | Verifier | Storefront | Owner action |
| --- | --- | --- | --- | --- |
| New identity, no history | stage candidate | may promote after normal gates | normal | none |
| Existing Core | reconcile only | update/reconcile | preserve current state | optional |
| LOCKED | report/reconcile only | no create/reopen | forced hidden | explicit reopen required |
| REOPENED | reconcile only | no recreate | current Core state | already explicitly reopened |
| SEEN_CORE but Core row absent | history/reconciliation debt | no recreate | no new card automatically | explicit recovery/reconciliation |

## Data intentionally not changed

This hardening does not change:
- bookings/customer records;
- physical phone/lens inventory quantities;
- package prices;
- The Weeknd 11 Oct visibility;
- Young K explicit reopen or its 790 / 990 pricing.

Only NuNew's unauthorized visibility was restored to hidden, owner visibility locks/history were persisted, and storefront visibility/package-status formulas were hardened.
