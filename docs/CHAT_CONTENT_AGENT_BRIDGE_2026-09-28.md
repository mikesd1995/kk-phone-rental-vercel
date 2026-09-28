# Chat → KK Content Agent Bridge — 2026-09-28

## Goal

Close the operational gap between a ChatGPT request for KK Phone Rental social copy and the repository-enforced content pipeline.

The bridge uses the already-connected GitHub account as the transport. It does not require a paid browser agent, Make.com, or a new external API key.

## End-to-end path

1. Chat verifies current business truth and event/hashtag facts.
2. Chat prepares exactly 3 differentiated internal candidates.
3. Chat creates a short-lived GitHub issue with title prefix `[KK-CONTENT-RUN]` and a bounded JSON payload.
4. GitHub Actions runs `.github/workflows/kk-content-chat-bridge.yml`.
5. The workflow executes `scripts/kk-content-chat-bridge.js`.
6. The bridge invokes `server/kk-agent-gateway.js`.
7. Mandatory route:
   **Marketing → Content Strategy → Content Agent → Content QA → Content Selector → Owner Review**
8. QA validates the three internal candidates.
9. Selector exposes exactly one final winner.
10. GitHub Actions writes a persistent result comment containing invocation evidence and the final post, then closes the bridge issue.
11. Chat reads the issue result and returns only the final post to the owner.

## Mandatory evidence rule

A chat response may claim the KK Agent pipeline was used only when the bridge result contains:

- status = `PASS`
- gateway status = `READY_FOR_OWNER_REVIEW`
- finalization gate = `PASS`
- QA = `PASS`
- Selector = `PASS`
- one invocation ID
- required agents and invoked agents are identical:
  - `kk-marketing-agent`
  - `kk-content-strategy`
  - `kk-content-agent`
  - `kk-content-qa`
  - `kk-content-selector`

If the result is missing, delayed, blocked, or the issue comment cannot be read back, the chat must not claim Agent execution.

## Payload contract

Issue title:

`[KK-CONTENT-RUN] <event or post subject>`

Issue body:

~~~md
<!-- KK_CONTENT_BRIDGE_PAYLOAD_START -->
~~~json
{
  "request": {
    "message": "ขอโพสปล่อยเช่างานนี้บน X",
    "input": {
      "event": "Example Concert",
      "verified_event": true,
      "verified_pricing": true,
      "price_display": "vivo X300 Pro 690฿ | เพิ่ม Lens +200฿",
      "inventory_available": true,
      "official_event_hashtag": "#ExampleConcert",
      "verified_hashtags": ["#ExampleConcert", "#ArtistExample", "#เช่ามือถือ"]
    }
  },
  "candidates": [
    {
      "id": "a",
      "angle": "event_theme",
      "copy": "...",
      "metrics": {
        "hook_strength": 80,
        "event_fandom_relevance": 85,
        "timing_relevance": 75,
        "novelty": 85,
        "hashtag_relevance": 100,
        "readability": 90,
        "commercial_relevance": 85
      }
    }
  ]
}
~~~
<!-- KK_CONTENT_BRIDGE_PAYLOAD_END -->
~~~

The real payload must contain exactly 3 candidates.

## Security

- Workflow runs only for issues with the `[KK-CONTENT-RUN]` prefix.
- Workflow runs only when `author_association == OWNER`.
- Body is limited to 64 KiB.
- Payload is parsed as JSON and never executed as shell.
- Candidate text is never interpolated into shell commands.
- Workflow permissions are least privilege:
  - contents: read
  - issues: write
- No production business writes.
- No automatic X publishing.
- No price/inventory mutation.
- Owner review remains mandatory.
- Bridge issues are closed after a result comment is persisted.

## Failure behavior

The bridge is fail-closed.

Examples:

- malformed payload → BLOCKED
- not exactly 3 candidates → BLOCKED
- missing required Agent stage → BLOCKED
- unverified commercial truth for rental post → BLOCKED
- unverified/synthesized hashtag → BLOCKED
- QA failure → BLOCKED
- Selector failure → BLOCKED
- issue comment persistence failure → workflow failure

A blocked run is not silently replaced by direct chat copy.

## Cost profile

The bridge itself uses GitHub Issues + GitHub Actions and the repository's deterministic Agent/QA/Selector code. It does not require Make.com or TinyFish browser automation.

Candidate language generation remains performed by the active ChatGPT conversation unless a separate model provider is deliberately wired later. The repository Agents still provide the mandatory marketing/strategy plan, validation, selection, and auditable invocation evidence.

## Files

- `.github/workflows/kk-content-chat-bridge.yml`
- `scripts/kk-content-chat-bridge.js`
- `tests/kk-content-chat-bridge.test.js`
- `server/kk-agent-gateway.js`
- `server/kk-content-request-router.js`
- `server/kk-content-qa-gate.js`
- `server/kk-content-selector.js`
