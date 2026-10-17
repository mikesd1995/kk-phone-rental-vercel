'use strict';

// READ-ONLY planning only. The caller must supply an authoritative full task
// inventory and the account's independently verified active-task limit.
// This module has NO automation, network, deployment or GitHub write actions.
function assess({tasks, inventoryComplete, limit, canonicalIds, ownerPause} = {}) {
  const base = {approval_required:true, task_writes:0, production_writes:0,
    can_auto_enable:false, can_auto_disable:false};
  const hold = (code, extra = {}) => ({...base, ok:false, classification:code, ...extra});
  if (!Array.isArray(tasks) || inventoryComplete !== true)
    return hold('HOLD_INCOMPLETE_TASK_INVENTORY');
  if (!Number.isSafeInteger(limit) || limit < 1)
    return hold('HOLD_UNVERIFIED_ACCOUNT_LIMIT');
  if (!canonicalIds || typeof canonicalIds.scanner !== 'string' ||
      !canonicalIds.scanner.trim() || typeof canonicalIds.verifier !== 'string' ||
      !canonicalIds.verifier.trim() || canonicalIds.scanner === canonicalIds.verifier)
    return hold('HOLD_CANONICAL_IDENTITY_INVALID');
  if (ownerPause !== false)
    return hold('HOLD_OWNER_PAUSE_NOT_CLEAR');
  const ids = new Set();
  let active = 0;
  for (const task of tasks) {
    if (!task || typeof task.id !== 'string' || !task.id.trim() ||
        ids.has(task.id) || typeof task.is_enabled !== 'boolean')
      return hold('HOLD_TASK_STATE_OR_ID_INVALID');
    ids.add(task.id);
    if (task.is_enabled) active++;
  }
  const canonical = tasks.filter(t =>
    t.id === canonicalIds.scanner || t.id === canonicalIds.verifier);
  if (canonical.length !== 2)
    return hold('HOLD_CANONICAL_TASK_MISSING');
  const toRestore = canonical.filter(t => !t.is_enabled).length;
  const needed = active + toRestore;
  const deficit = Math.max(0, needed - limit);
  return {...base, ok:deficit === 0,
    classification:deficit ? 'HOLD_CAPACITY_REBALANCE_REQUIRED' : 'READY_FOR_SEPARATE_OWNER_REVIEW',
    active_count:active, canonical_off:toRestore,
    verified_limit:limit, slots_needed:toRestore, slots_to_free:deficit};
}
module.exports = {assess};
