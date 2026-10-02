# X Posting Plan Default Marketing Agent — 2026-10-02

## Status

This change makes KK Phone Rental X posting-plan requests a governed default route instead of an optional/manual convention.

Canonical runtime route:

**Chat request → Agent Gateway → x_posting_plan → Marketing Agent V2 + X Signal Detector V2 → slot ranking → Owner Review**

No explicit "enable agent" command is required once the request matches the X posting-plan intent.

## Trigger

The gateway auto-detects ordinary chat requests that mention X/Twitter and ask what should be posted, how posts should be queued, or how the evening/late-night window should be split.

Example accepted intent:

> ไปตรวจสอบ X ว่าตอนนี้ควรโพสอะไรต่อจากเดิม ตั้งแต่ 19.30 ไปจนถึงช่วง late night

The chat surface must still enter the private Agent Gateway. The repository cannot force an external chat product to call the gateway if that surface bypasses it.

## Bangkok time-slot contract

Default timezone: `Asia/Bangkok`

| Time | Zone | Default action |
| --- | --- | --- |
| 19:30 | PRIME_OPEN | STANDALONE |
| 21:00 | PRIME_CORE | STANDALONE |
| 22:30 | LATE_PRIME | STANDALONE |
| 00:00 | LATE_NIGHT | CONVERSATION_CAPTURE |

Slots can be supplied explicitly, but the default schedule above is used when none is supplied.

## Ranking contract

Each candidate is ranked using six explicit dimensions:

1. engagement velocity — 30%
2. search/conversation volume — 20%
3. event proximity — 15%
4. fandom strength — 15%
5. competitor rental activity — 5%
6. KK booking/conversion opportunity — 15%

A recent-post fatigue penalty is then applied so an event that was just posted does not automatically consume the next prime slot even when its raw demand signal is strong.

The Marketing Agent is actually invoked for each candidate. Its current X-signal analysis and opportunity score are available to the planner as grounded fallbacks when supplied candidate evidence does not already contain a normalized value.

This is a prioritization model for expected qualified reach, engagement and booking intent. It does not claim or guarantee maximum reach.

## Persistence across chats

Project Memory contains the locked rule:

`kk:memory:content:x-posting-plan-default:20261002`

New KK sessions that bootstrap project memory recover this route as an active content rule. The owner should not need to request agent activation again before asking what to post on X.

Project Memory is workflow memory, not current business truth. Current event facts, price, inventory, X signals and competitor observations still require live/canonical evidence on each run.

## Safety

- Marketing Agent authority remains `READ_ONLY_ADVISOR`.
- No automatic X publishing.
- No ad spend.
- No pricing writes.
- No inventory writes.
- `production_writes=0`.
- `publishes=0`.
- Owner review remains required.

## Runtime/version changes

- `server/kk-x-posting-plan.js` → `KK_X_POSTING_PLAN_V1`
- `server/kk-agent-gateway.js` → `KK_AGENT_GATEWAY_V5`
- `server/kk-agent-task-router.js` → `KK_AGENT_TASK_ROUTER_V19`
- `server/kk-agent-registry.js` → `KK_AGENT_REGISTRY_V29`
- Registry Marketing Agent version corrected to `KK_MARKETING_AGENT_V2_X_SIGNAL`
- Persistent invocation evidence is mandatory for `x_posting_plan`.

## Acceptance contract

Regression coverage must prove:

- plain-language X planning requests auto-route to `x_posting_plan`;
- the registered and invoked Agent is `kk-marketing-agent`;
- the four Bangkok slots are produced;
- six ranking dimensions and recent-post fatigue are exposed;
- duplicate event assignment across slots is prevented;
- project memory contains the active locked rule;
- writes and publishes remain zero.

The first RED run on PR #472 produced exactly one failure because `server/kk-x-posting-plan.js` did not yet exist, while 1,094 existing tests passed. GREEN acceptance requires the current branch's full Admin Regression and Project Memory Enforcement workflows to pass before merge.
