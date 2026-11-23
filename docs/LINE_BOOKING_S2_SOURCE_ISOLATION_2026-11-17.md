# LINE booking S2: isolated test source contract

Release Hold. Source/local preparation only. This file does not authorize provider changes, Restore, push/CI, real LINE traffic or Merge/Deploy. Existing A+D2 remain candidates, not native-ready resources.

Production mode retains the canonical fixed public origin, current request-ID algorithm, kkb1 cards, backend/consent/outbox semantics and current price/stock/payment behavior. `config.js` now explicitly sets public `customerLoginEnabled: false`; enabling it requires a separately approved isolated carrier and verified server Login/callback/consent bindings. No secret belongs in browser configuration.

When `KK_LINE_BOOKING_TEST_MODE` is exact `true`, the existing private actor list remains mandatory. S2 also requires these **new source knobs**, absent from c4:

| Name | Contract |
|---|---|
| `KK_LINE_BOOKING_TEST_ORIGIN` | Exact canonical HTTPS origin only: no trailing slash/path/query/fragment/credentials/port/IP/localhost/known Production origin. Owner must separately verify target ownership/isolation; syntax is not proof of that. |
| `KK_LINE_BOOKING_TEST_SCOPE` | Fixed nonsecret 16–64 ASCII alphanumeric/underscore/hyphen run identifier. A new run uses a new scope. |
| `KK_LINE_BOOKING_TEST_WINDOW_START` / `KK_LINE_BOOKING_TEST_WINDOW_END` | Exact UTC ISO timestamps including milliseconds; end > start, duration at most one hour. Fixed across recovery, never extended automatically. Both processing time and signed event timestamp must be in the window; future timestamps over30seconds are denied. |
| `KK_LINE_BOOKING_TEST_EVENT_IDS` | 1–10 unique exact `EVT-...` IDs for approved dummy canonical events; no whitespace/duplicates. Configuration does not create dummy data. |
| `KK_LINE_APPROVAL_SECRET` | Existing knob, now mandatory explicitly in test mode: 32–128 base64url characters, distinct from Messaging/admin/initial/decision keys. No Messaging-secret fallback for test signatures. Owner operates secret stores; this source change does not read/copy/rotate live keys. |

S2 origin/scope/window/event overrides outside test mode are rejected rather than falling back silently to Production. Existing pure actor admission and auth API policy remain separate; S2 target config is enforced by booking webhook/owner/poster paths, not a substitute for target binding or provider-side containment.

Test webhook and poster HTTP handlers require the actual Host header to match that origin; forwarded host alone is not accepted. Direct target configuration also verifies the owner/target are private allowlisted users. Each injected transport invocation rechecks the fixed window, including dispatch after an awaited claim. A request already in flight can finish after expiry; this is not permission to start another send/settlement. An expiry after a claim leaves manual reconciliation required and never authorizes a resend.

Test webhook traffic requires literal `true` automation/initial-outbox/owner-outbox flags. During OFF preparation, webhook fails closed before Inbox/profile/media or replies. A valid test context is still not a provider-message quota. No scheduler, alternate sender or webhook relay is introduced.

Feed, poster proxy and Terms recovery links use the approved test origin. Test reads set `redirect: error`; redirected/foreign responses are rejected and never fall back to Production. Test posters must resolve to `/assets/event-posters/` on that same origin. The public poster API passes server configuration, checks the allowed event/window and returns `Cache-Control: no-store` in test mode. Its Production behavior remains on the previous origin/allowlist/cache policy. Inbox remains its own existing binding; this change does not repoint it to auth D2.

Before canonical creation, an internal cloned event derives a stable, domain-separated HMAC identity from fixed scope/origin/window/event set and immutable original webhookEventId. Existing Intake then produces the same `line:<48hex>` shape. Missing original IDs remain invalid; timestamp/replyToken/randomness do not become request IDs. The original signed event used by Inbox is not mutated.

Test owner card actions use `kkt1|decision|bookingId|request_id|signature`. The signature binds scope/origin/window/event set, decision and both IDs. The request ID comes from the validated initial-outbox envelope, without adding fields to the frozen12-field context or changing GAS/outbox schemas. Old kkb1, foreign-run or modified actions are rejected before GAS readiness/decision calls. Production still uses kkb1. Test legacy `notifyOwner` push is blocked; both durable notification flows are required.

Keep scope/origin/window/event IDs/key fixed during recovery. SENT message-hash mismatch, CLAIMED or UNCERTAIN retain the existing manual-review/no-resend behavior. Do not re-sign historical envelopes, clear claims, reset rows, backfill or replay to fill acceptance evidence. A scoped signature proves the issuing server's source context; native target/version/key equality and exact canonical provenance must still be verified separately before real tests.

Pending native gates: A+D2 history/data/retention/callers/containment, target carrier/origin/SHA/routing of text+postback, same-provider Login and consenting actors, GAS version/headers/capabilities, D2 native catalog/ACL/RLS, explicit finite provider budget, delivery/ACK/canonical readback and owner UAT. No local test establishes these. Existing OA has one configured webhook; adding source configuration does not route that webhook to a new carrier.
