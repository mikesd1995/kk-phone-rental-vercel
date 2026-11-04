# Make 6176241: exact connector serialization

The finite-round compiler emits a pure local descriptor with before/after snapshot fingerprints. Its separate interface intent and `filter_set/remove:true` local inverse were not directly valid `scenario_patch` arguments. No runtime guard needs to be rewritten to solve that transport mismatch.

On 4 November 2026, bounded diagnostic refusals from the actual Make A connector enumerated `interface_set` and stated that `filter_set` requires `filter`, with `{}` removing the gate. One composed confirmation request set the exact unchanged interface, removed an already-absent filter on disabled orphan26 with `filter:{}`, and explicitly reasserted all eleven OFF flags. The request was accepted. Fresh complete structure and all15configs matched the before state, including absent filter26, all OFF, inactive/on-demand, no incomplete/locks; lastEdit remained `2026-10-29T01:01:09.378Z`. No run/provider/GAS operation occurred. Source proof is separate from runtime delivery proof.

`server/make-owner-canonical-connector-patch.js` now converts a locally validated compiler patch into only these connector fields:

```js
const Stage = require('../server/make-owner-canonical-real-acceptance-stage');
const Connector = require('../server/make-owner-canonical-connector-patch');
const stage = Stage.prepareRealAcceptanceStage(freshSnapshot, reviewedBinding);
const request = Connector.toConnectorRequest(freshSnapshot, stage.patch);
// request is data only: scenarioId, expectedLastEdit, operations.
// Add the trusted existing Make A link_id only at the authorized tool boundary.
```

For restoration, obtain fresh complete after-content and lastEdit, use `Stage.prepareInversePatch(stage,current,current.lastEdit)`, then pass that descriptor with current to the same serializer. Interface becomes an `interface_set` operation in the same composed call. A local remove intent becomes `filter_set` with `filter:{}`; no `remove` field is sent. The serializer retains exact local CAS/result verification and rejects extra operation fields, unsupported operation/module targets or any enabling instruction. It has no network, credentials, clock, round generator, installation or run capability.

Do not send the raw stage descriptor wholesale or treat its historical `connector_ready:false` metadata as the runtime connector contract. Do not replace the source compiler's unresolved operational gates with a blanket PASS. The serializer resolves formatting only; live policy, exact source approval, trusted fresh manifest/source pair, complete configuration/settings readback, independent plan review, single writer, guarded save, exact post-save readback and shutdown still apply.

The confirmation did not move canonical26 into the main graph, change required inputs, install a round or open any flag. Such finite installation still requires its concrete reviewed real round manifest. Keep Scanner/Verifier unchanged and do not admit old/fixture work. The inverse must use the current post-save token rather than a historical clock.

Validation includes forward/inverse full-snapshot roundtrips through the actual-shaped contract, stale/fingerprint refusals and adversarial operation-field cases. Current source runtime contracts and UI remain unchanged. The obsolete share-CTA test on current main was separately replaced with execution of the existing URL helper and encoding checks; no storefront implementation change is included.
