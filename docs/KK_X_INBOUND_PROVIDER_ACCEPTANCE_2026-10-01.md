# X inbound provider acceptance gate — 2026-10-01

## Verified provider evidence

X Developer Platform troubleshooting documentation still describes the Account Activity API webhook flow, including:

- webhook registration using OAuth 1.0a User Context rather than OAuth 2.0 Bearer authentication;
- access tokens with Read, write, and Direct Messages permission;
- HTTPS webhook URI;
- CRC GET response latency below 3 seconds;
- Account Activity subscription and webhook registration errors including duplicate subscription handling.

X Direct Message documentation continues to describe `message_create` as the Direct Message event type and the nested `message_create.target.recipient_id` / `message_create.message_data` structure.

## KK acceptance rule

This repository may prepare CRC/signature parsing and `direct_message_events[].message_create` normalization, but MUST NOT register a production X webhook until:

1. Vercel deployment acceptance is READY.
2. The KK X app is proven entitled to the Account Activity webhook endpoints with a harmless authenticated read/registration probe.
3. OAuth 1.0a credentials required by webhook registration are available server-side without exposing them to browser code or logs.
4. CRC completes within the provider deadline.
5. A real provider DM is observed, persisted exactly once, and a redelivery/duplicate does not create a second logical message.
6. Outbound DM and AI auto-send remain disabled until a separate owner-approved acceptance.

## Current state

Code preparation only. No X webhook URL is registered and no production X subscription is created by this branch.
