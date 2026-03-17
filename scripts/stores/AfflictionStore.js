import { MODULE_ID } from '../constants.js';

/**
 * Returns the correct document for flag storage:
 * - Linked tokens → actor (persists across scenes)
 * - Unlinked tokens → token document (per-placement)
 */
function _getDocument(token) {
  if (token?.document?.actorLink && token.actor) return token.actor;
  return token?.document;
}

// ── Token-based API (existing callers) ─────────────────────────────────────

export function getAfflictions(token) {
  const doc = _getDocument(token);
  return doc?.getFlag(MODULE_ID, 'afflictions') ?? {};
}

export async function setAfflictions(token, afflictions) {
  const doc = _getDocument(token);
  if (!doc) {
    console.error('AfflictionStore: No storage document');
    return;
  }

  if (!game.user.isGM) {
    console.error('AfflictionStore: Non-GM user attempted to set afflictions');
    ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.GM_ONLY_MANAGE'));
    return;
  }

  await doc.setFlag(MODULE_ID, 'afflictions', afflictions);
}

export function getAffliction(token, afflictionId) {
  const afflictions = getAfflictions(token);
  return afflictions[afflictionId] || null;
}

export async function addAffliction(token, afflictionData) {
  const afflictions = { ...getAfflictions(token) };
  afflictions[afflictionData.id] = afflictionData;
  await setAfflictions(token, afflictions);
}

export async function updateAffliction(token, afflictionId, updates) {
  const afflictions = { ...getAfflictions(token) };
  if (afflictions[afflictionId]) {
    afflictions[afflictionId] = { ...afflictions[afflictionId], ...updates };
    await setAfflictions(token, afflictions);
  }
}

export async function removeAffliction(token, afflictionId) {
  if (!game.user.isGM) {
    console.error('AfflictionStore: Non-GM user attempted to remove affliction');
    ui.notifications.error(game.i18n.localize('PF2E_AFFLICTIONER.ERRORS.GM_ONLY_MANAGE'));
    return;
  }

  const doc = _getDocument(token);
  await doc.unsetFlag(MODULE_ID, `afflictions.${afflictionId}`);

  await new Promise(resolve => setTimeout(resolve, 50));
}

// ── Actor-direct API (for off-scene operations) ────────────────────────────

export function getAfflictionsForActor(actor) {
  return actor?.getFlag(MODULE_ID, 'afflictions') ?? {};
}

export function getAfflictionForActor(actor, afflictionId) {
  const afflictions = getAfflictionsForActor(actor);
  return afflictions[afflictionId] || null;
}

export async function addAfflictionForActor(actor, afflictionData) {
  if (!actor || !game.user.isGM) return;
  const afflictions = { ...getAfflictionsForActor(actor) };
  afflictions[afflictionData.id] = afflictionData;
  await actor.setFlag(MODULE_ID, 'afflictions', afflictions);
}

export async function updateAfflictionForActor(actor, afflictionId, updates) {
  if (!actor || !game.user.isGM) return;
  const afflictions = { ...getAfflictionsForActor(actor) };
  if (afflictions[afflictionId]) {
    afflictions[afflictionId] = { ...afflictions[afflictionId], ...updates };
    await actor.setFlag(MODULE_ID, 'afflictions', afflictions);
  }
}

export async function removeAfflictionForActor(actor, afflictionId) {
  if (!actor || !game.user.isGM) return;
  await actor.unsetFlag(MODULE_ID, `afflictions.${afflictionId}`);
  await new Promise(resolve => setTimeout(resolve, 50));
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find a linked token for the given actor on the current scene.
 * Returns null if no token is present.
 */
export function findTokenForActor(actor) {
  if (!actor || !canvas?.tokens) return null;
  return canvas.tokens.placeables.find(t => t.document.actorLink && t.actor?.id === actor.id) ?? null;
}

/**
 * Returns all afflicted entities: on-scene tokens AND off-scene actors.
 * Each entry has { token, actor, afflictions } where token may be null.
 */
export function getTokensWithAfflictions() {
  const results = [];
  const seenActorIds = new Set();

  // On-scene tokens
  for (const token of canvas.tokens.placeables) {
    const afflictions = getAfflictions(token);
    if (Object.keys(afflictions).length > 0) {
      results.push({ token, actor: token.actor, afflictions });
      if (token.document.actorLink && token.actor) {
        seenActorIds.add(token.actor.id);
      }
    }
  }

  // Off-scene linked actors
  for (const actor of game.actors) {
    if (seenActorIds.has(actor.id)) continue;
    const afflictions = getAfflictionsForActor(actor);
    if (Object.keys(afflictions).length > 0) {
      results.push({ token: null, actor, afflictions });
    }
  }

  return results;
}
