# KK Phone Rental — Core v1 Finish Pack

## Finish line
Core v1 is only:

`Scanner → Verifier → canonical Google Sheet write → monthly projection → _Notification_Ledger → Telegram + LINE`

Everything else is frozen until this path passes end-to-end.

## Why this notifier exists
Current scanner/verifier is producing business events and the ledger, but old rows are stuck at `HOLD_TRANSPORT_QUARANTINE`. The notifier is a single authoritative consumer of `_Notification_Ledger`.

It intentionally ignores historical `HOLD_TRANSPORT_QUARANTINE` rows so setup does not flood old alerts.

## Install location
Use the **Event Tracker** Google Sheet:

`1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`

Open **Extensions → Apps Script**, add `CoreV1Notifier.gs`, paste the file contents, save, then run `kkCoreV1SetupInteractive` once.

You will be asked for:

- Telegram Bot Token
- Telegram Chat ID
- LINE Messaging API Channel Access Token
- LINE target userId / groupId / roomId

The script stores them only in Apps Script Script Properties.

## After setup
Run `kkCoreV1RunTransportUAT` once. You should receive one test message in Telegram and one in LINE.

The sender then runs every 5 minutes and consumes only ledger rows with status `QUEUED` or `RETRY_WAIT`.

## Safety
- No event scanning logic in this file.
- No DCRM/booking/public website changes.
- No Apps Script backend `Code.gs` changes.
- Historical quarantined alerts are not sent automatically.
- A row becomes `SENT` only after the provider API acknowledges success.
- Same `Transport + Dedup Key` cannot send twice after a successful send.
- Failures use retry backoff and retain `Last Error` evidence.

## Core v1 PASS
Transport UAT alone is not enough. Final PASS requires one eligible real/canary event to prove:

1. Scanner run recorded.
2. Verifier writes canonical lifecycle/evidence.
3. Correct monthly row is updated.
4. Exactly one Telegram ledger row + one LINE ledger row are staged.
5. Telegram row becomes `SENT` with provider message evidence.
6. LINE row becomes `SENT` with provider request evidence.
7. No duplicate owner notification.
