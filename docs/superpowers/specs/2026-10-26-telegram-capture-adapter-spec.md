# Same-617 Telegram response adapter specification — 26 October 2026

Owner authorization: investigate original refusal capture from live Make6176241; if unproven, build a connector on the existing path, update draft793, test/review, keep sender OFF and never replay old work. The owner opted out of further questions. Existing isolated feature branch is reused.

## Evidence and selected boundary
Read-only available Make history has two runs, neither invoked Telegram8. Current native Telegram schema does not prove original refused response availability. Public Make documentation says HTTP400..599 always raises error; valid:true cannot make it success. Original body cannot be reconstructed from generic RateLimitError/text429. Same617 is the one Telegram consumer under Active policy150/225/235; GAS sendTelegram_ remains forbidden.

Use a small Make custom-app action on SAME617. Its own documented response.error builds a versioned bounded JSON frame from original HTTP status and FULL original provider body using createJSON. Keeping full original body is essential: do not remove result/message/acceptance/unknown keys and thereby turn a contradiction into retry. Gateway strictly parses/rejects malformed/unknown/contradictory outcomes, then uses existing native outcome/projection loop. Do not reuse guessed native8.error.* body fields.

## Send-start and physical sender
A sequential two-request communication array first calls fixed authenticated canonical-dispatch-start on the existing gateway. Native exact RESERVED attempt/receipt/descriptor/originalTTL+15s margin performs one atomic send-start CAS and persists immutable dispatch UUID/time. Request2 calls only fixed Telegram sendMessage if an exact fresh grant is valid, using gateway-rendered owner chat/text. Full-module re-execution gets no second grant. Unknown transport outcomes remain fenced. No repeat/pagination/sleep/Break/Resume; HTTP refusal error type RuntimeError, not RateLimitError. Actual engine second-request retry granularity remains separate unproven runtime evidence before activation.

Secrets belong to the new Make adapter connection only: bot credential and gateway consumer bearer are separate secret properties. Bearer header exists ONLY on request1, bot credential ONLY in fixed Telegram URL; no global Authorization. Sanitize request headers and request URL; no logs/source/blueprint secret values. Existing native10356915 is opaque and not assumed compatible or samebot. New connection/botID requires future credential-free identity attestation.

## Binding and state
Add immutable canonical-only provider binding for adapter kind, app/module name, actual assigned Make module ID, new connection ID, bot identity and reviewed manifest hash. No hardcoded false native8/10356915 identity. Preserve native-mode defaults/legacy UAT unchanged. Native readback supplies binding and exact send-start proof. Adapter result receipt is correlated with original attempt/receipt/dispatch/binding and original expiry. A positive valid messageID uses durable native ACK then existing GAS Sheet projection; proven refusal uses native rejection then exact projection confirmation. No network/provider dispatch is added to GAS or Node gateway.

The adapter compiler is OFF-only and requires a fresh same617 snapshot, actual assigned module IDs, exact semantic manifest/URL/auth/frame/no-retry checks, pinned hashes and explicit unbound-vs-verified connection state. It must not activate, deploy, send or invent credential bindings. Installation scope is separate from source acceptance.

## Tests and completion boundary
RED/GREEN native CAS, doubleclaim, oldattempt, expired original TTL/margin, missingbinding, framebytes/types/status/body mismatch/fullbodycontradiction, secret sentinels, wrongendpoints/globalheader/no-retry, actualgateway/GAS/native loop under sameidentity. Keep earlier31native/5loop/2395source+ACL29 regression. Independent review and hosted exact-head CI required; inspect all annotations. No real provider ACK claim from synthetic tests.

Live custom app management read was refused with UNAUTHORIZED requiring sdk-apps:read; no app write was attempted. Source package can still be completed/reviewed on draft793. Do not reroute around account authorization or install a synthetic/native profile. Any future live app installation requires proper account authorization, new secure connection and samebot attestation while senders stayOFF.
