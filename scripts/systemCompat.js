/**
 * System compatibility layer for PF2e and SF2e support.
 * Both systems share the same codebase, so hooks (pf2e.*) and game.pf2e API are identical.
 * Differences: message flags (pf2e vs sf2e) and condition compendium pack names
 * (pf2e.conditionitems vs sf2e.conditions).
 */

let _namespace = null;

/**
 * Call once during the 'init' hook to capture the active system ID.
 */
export function detectSystem() {
  _namespace = null;
}

/**
 * Returns the flag namespace used by the active system ('pf2e' or 'sf2e').
 * Lazy-detected on first call since game.pf2e may not exist until 'ready'.
 */
export function getSystemNamespace() {
  if (_namespace) return _namespace;
  if (game.pf2e) _namespace = 'pf2e';
  else if (game.sf2e) _namespace = 'sf2e';
  else _namespace = game.system?.id || 'pf2e';
  return _namespace;
}

/** Returns system-specific flags from a message or document. */
export function getSystemFlags(obj) {
  const ns = getSystemNamespace();
  return obj?.flags?.[ns];
}

/** Returns the conditions compendium pack (pf2e.conditionitems or sf2e.conditions). */
export function getConditionPack() {
  return game.packs.get('pf2e.conditionitems') || game.packs.get('sf2e.conditions');
}

/** Returns a Compendium UUID for a condition entry. */
export function getConditionUuidFromEntry(pack, entryId) {
  return `Compendium.${pack.collection}.Item.${entryId}`;
}
