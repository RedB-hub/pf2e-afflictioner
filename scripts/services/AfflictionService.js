import { DEGREE_OF_SUCCESS, MODULE_ID } from '../constants.js';
import * as AfflictionStore from '../stores/AfflictionStore.js';
import { AfflictionParser } from './AfflictionParser.js';
import * as AfflictionDefinitionStore from '../stores/AfflictionDefinitionStore.js';
import { AfflictionEditorService } from './AfflictionEditorService.js';
import { AfflictionEffectBuilder } from './AfflictionEffectBuilder.js';
import { AfflictionChatService } from './AfflictionChatService.js';
import { AfflictionTimerService } from './AfflictionTimerService.js';
import { FeatsService } from './FeatsService.js';

export class AfflictionService {
  static async promptInitialSave(token, afflictionData, actor = null) {
    actor = actor || token?.actor;
    if (!actor) return;
    const entityName = token?.name || actor?.name || 'Unknown';

    const key = AfflictionDefinitionStore.generateDefinitionKey(afflictionData);
    const editedDef = AfflictionDefinitionStore.getEditedDefinition(key);

    if (editedDef) {
      afflictionData = AfflictionEditorService.applyEditedDefinition(afflictionData, editedDef);
    }

    const existingAffliction = token
      ? this.findExistingAffliction(token, afflictionData.name)
      : this.findExistingAfflictionForActor(actor, afflictionData.name);

    if (existingAffliction) {
      if (afflictionData.multipleExposure?.enabled) {
        await this.handleMultipleExposure(token, existingAffliction, afflictionData, actor);
        return;
      } else if (afflictionData.type === 'poison') {
        afflictionData._isReExposure = true;
        afflictionData._existingAfflictionId = existingAffliction.id;
      } else {
        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MULTIPLE_EXPOSURE_NO_EFFECT_DEFAULT', {
          tokenName: entityName,
          afflictionName: afflictionData.name,
          type: afflictionData.type
        }));
        return;
      }
    }

    const afflictionId = foundry.utils.randomID();
    const combat = game.combat;

    const affliction = {
      id: afflictionId,
      ...afflictionData,
      currentStage: -1,
      inOnset: false,
      needsInitialSave: true,
      onsetRemaining: 0,
      nextSaveRound: null,
      nextSaveInitiative: null,
      applicationInitiative: combat?.combatant?.initiative ?? null,
      stageStartRound: combat ? combat.round : null,
      addedRound: combat ? combat.round : null,
      durationElapsed: 0,
      maxDurationElapsed: 0,
      effectIntervalElapsed: 0,
      nextEffectRound: null,
      nextEffectTimestamp: null,
      onsetEffectIntervalElapsed: 0,
      nextOnsetEffectRound: null,
      nextOnsetEffectTimestamp: null,
      nextSaveTimestamp: null,
      treatmentBonus: 0,
      treatedThisStage: false,
      addedTimestamp: Date.now(),
      addedInCombat: !!combat,
      combatId: combat?.id
    };

    if (token) {
      await AfflictionStore.addAffliction(token, affliction);
      const { VisualService } = await import('./VisualService.js');
      await VisualService.addAfflictionIndicator(token);
    } else if (actor) {
      await AfflictionStore.addAfflictionForActor(actor, affliction);
    }

    await AfflictionChatService.promptInitialSave(token, affliction, afflictionData, afflictionId);
  }

  static async handleInitialSave(token, affliction, saveTotal, dc, dieValue = null, actor = null) {
    actor = actor || token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    let degree = this.calculateDegreeOfSuccess(saveTotal, dc, dieValue);

    if (affliction.blowgunPoisonerCrit) {
      const degraded = FeatsService.degradeDegree(degree);
      if (degraded !== degree) {
        degree = degraded;
        ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.FEATS.BLOWGUN_POISONER_APPLIED', {
          targetName: entityName,
          afflictionName: affliction.name
        }));
      }
    }

    const isReExposure = affliction._isReExposure;
    const existingAfflictionId = affliction._existingAfflictionId;

    if (degree === DEGREE_OF_SUCCESS.SUCCESS || degree === DEGREE_OF_SUCCESS.CRITICAL_SUCCESS) {
      // Pernicious Poison: on success (not crit success), deal flat poison damage = poison level
      if (degree === DEGREE_OF_SUCCESS.SUCCESS && affliction.perniciousPoisonLevel > 0 && token) {
        await AfflictionChatService.promptPerniciousPoisonDamage(token, affliction);
      }

      if (token) {
        await AfflictionStore.removeAffliction(token, affliction.id);
        await this.removeStageEffects(token, affliction, null, null);
        const remainingAfflictions = AfflictionStore.getAfflictions(token);
        if (Object.keys(remainingAfflictions).length === 0) {
          const { VisualService } = await import('./VisualService.js');
          await VisualService.removeAfflictionIndicator(token);
        }
      } else if (actor) {
        await AfflictionStore.removeAfflictionForActor(actor, affliction.id);
      }

      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.RESISTED', {
        tokenName: entityName,
        afflictionName: affliction.name
      }));
      return;
    }

    if (isReExposure && existingAfflictionId && affliction.type === 'poison' && token) {
      const existingAffliction = AfflictionStore.getAffliction(token, existingAfflictionId);
      if (existingAffliction) {
        await AfflictionStore.removeAffliction(token, affliction.id);
        await this.removeStageEffects(token, affliction, null, null);

        const stageIncrease = degree === DEGREE_OF_SUCCESS.CRITICAL_FAILURE ? 2 : 1;
        await this.handlePoisonReExposure(token, existingAffliction, stageIncrease);
        return;
      }
    }

    const combat = game.combat;

    let startingStage = 0;
    let stageAdvancement = 1;

    if (affliction.onset) {
      startingStage = 0;
      stageAdvancement = degree === DEGREE_OF_SUCCESS.CRITICAL_FAILURE ? 2 : 1;
    } else {
      startingStage = degree === DEGREE_OF_SUCCESS.CRITICAL_FAILURE ? 2 : 1;
      stageAdvancement = 1;
    }

    const updates = {
      currentStage: startingStage,
      needsInitialSave: false,
      inOnset: !!affliction.onset,
      onsetRemaining: AfflictionParser.durationToSeconds(affliction.onset),
      stageAdvancement: stageAdvancement,
      nextSaveRound: combat ? combat.round : null,
      nextSaveInitiative: (combat && token) ? combat.combatants.find(c => c.tokenId === token.id)?.initiative : null,
      stageStartRound: combat ? combat.round : null,
      nextSaveTimestamp: null
    };

    if (affliction.onset) {
      if (combat) {
        const onsetRounds = Math.ceil(updates.onsetRemaining / 6);
        updates.nextSaveRound = combat.round + onsetRounds;
        if (token) updates.nextSaveInitiative = this.getSaveInitiative(affliction, token, combat);
      } else {
        updates.nextSaveTimestamp = game.time.worldTime + updates.onsetRemaining;
      }

      updates.onsetEffectIntervalElapsed = 0;
      updates.nextOnsetEffectRound = null;
      updates.nextOnsetEffectTimestamp = null;

      if (affliction.onsetEffectInterval) {
        const onsetIntervalSeconds = AfflictionParser.durationToSeconds(affliction.onsetEffectInterval);
        if (combat) {
          updates.nextOnsetEffectRound = combat.round + Math.ceil(onsetIntervalSeconds / 6);
        } else {
          updates.nextOnsetEffectTimestamp = game.time.worldTime + onsetIntervalSeconds;
        }
      }

      if (token) {
        await AfflictionStore.updateAffliction(token, affliction.id, updates);
        const updatedAffliction = AfflictionStore.getAffliction(token, affliction.id);
        await AfflictionEffectBuilder.createOrUpdateEffect(token, actor, updatedAffliction, {
          effects: '', rawText: 'Onset', duration: affliction.onset
        });
      } else if (actor) {
        await AfflictionStore.updateAfflictionForActor(actor, affliction.id, updates);
      }
    } else {
      const initialStage = affliction.stages[startingStage - 1];
      if (!initialStage) {
        ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.STAGE_NOT_FOUND', { stage: startingStage, affliction: affliction.name }));
        return;
      }

      const initialDurationCopy = initialStage.duration ? { ...initialStage.duration } : null;
      if (combat) {
        const durationSeconds = await AfflictionParser.resolveStageDuration(initialDurationCopy, `${affliction.name} Stage ${startingStage}`);
        const durationRounds = Math.ceil(durationSeconds / 6);
        updates.nextSaveRound = combat.round + durationRounds;
        if (token) updates.nextSaveInitiative = this.getSaveInitiative(affliction, token, combat);
      } else {
        const durationSeconds = await AfflictionParser.resolveStageDuration(initialDurationCopy, `${affliction.name} Stage ${startingStage}`);
        updates.nextSaveTimestamp = game.time.worldTime + durationSeconds;
      }
      if (initialDurationCopy?.value > 0) {
        updates.currentStageResolvedDuration = { value: initialDurationCopy.value, unit: initialDurationCopy.unit };
      }

      if (initialStage.effectInterval) {
        const effectIntervalSeconds = AfflictionParser.durationToSeconds(initialStage.effectInterval);
        if (combat) {
          const effectRounds = Math.ceil(effectIntervalSeconds / 6);
          updates.nextEffectRound = combat.round + effectRounds;
        } else {
          updates.nextEffectTimestamp = game.time.worldTime + effectIntervalSeconds;
        }
      }

      if (token) {
        await AfflictionStore.updateAffliction(token, affliction.id, updates);
        const updatedAffliction = AfflictionStore.getAffliction(token, affliction.id);
        await this.applyStageEffects(token, updatedAffliction, initialStage);
        if (initialStage.damage && initialStage.damage.length > 0) {
          await this.promptDamage(token, updatedAffliction);
        }
      } else if (actor) {
        await AfflictionStore.updateAfflictionForActor(actor, affliction.id, updates);
      }
    }

    ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.AFFLICTED', {
      tokenName: entityName,
      afflictionName: affliction.name
    }));
  }

  static async checkForScheduledSaves(token, combat) {
    await AfflictionTimerService.checkForScheduledSaves(token, combat, this);
  }

  static async promptSave(token, affliction, actor = null) {
    await AfflictionChatService.promptStageSave(token, affliction, actor);
  }

  static async promptDamage(token, affliction, actor = null) {
    await AfflictionChatService.promptDamage(token, affliction, actor);
  }

  static async handleStageSave(token, affliction, saveTotal, dc, isManual = false, dieValue = null, actor = null) {
    actor = actor || token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    const degree = this.calculateDegreeOfSuccess(saveTotal, dc, dieValue);
    const combat = game.combat;

    let stageChange = 0;
    let newVirulentConsecutiveSuccesses = affliction.virulentConsecutiveSuccesses || 0;
    let showVirulentMessage = false;

    const fastRecoveryChange = !isManual ? FeatsService.getFastRecoveryStageChange(degree, affliction.isVirulent) : null;
    const fastRecoveryApplied = fastRecoveryChange !== null && FeatsService.hasFastRecovery(actor);
    if (fastRecoveryApplied) {
      stageChange = fastRecoveryChange;
      newVirulentConsecutiveSuccesses = 0;
    } else if (affliction.isVirulent && !isManual) {
      switch (degree) {
        case DEGREE_OF_SUCCESS.CRITICAL_SUCCESS:
          stageChange = -1;
          newVirulentConsecutiveSuccesses = 0;
          break;
        case DEGREE_OF_SUCCESS.SUCCESS:
          if (newVirulentConsecutiveSuccesses >= 1) {
            stageChange = -1;
            newVirulentConsecutiveSuccesses = 0;
          } else {
            stageChange = 0;
            newVirulentConsecutiveSuccesses++;
            showVirulentMessage = true;
          }
          break;
        case DEGREE_OF_SUCCESS.FAILURE:
          stageChange = 1;
          newVirulentConsecutiveSuccesses = 0;
          break;
        case DEGREE_OF_SUCCESS.CRITICAL_FAILURE:
          stageChange = 2;
          newVirulentConsecutiveSuccesses = 0;
          break;
      }
    } else {
      switch (degree) {
        case DEGREE_OF_SUCCESS.CRITICAL_SUCCESS:
          stageChange = -2;
          break;
        case DEGREE_OF_SUCCESS.SUCCESS:
          stageChange = -1;
          break;
        case DEGREE_OF_SUCCESS.FAILURE:
          stageChange = 1;
          break;
        case DEGREE_OF_SUCCESS.CRITICAL_FAILURE:
          stageChange = 2;
          break;
      }
    }

    const minStage = isManual ? 1 : 0;
    const newStage = Math.max(minStage, affliction.currentStage + stageChange);

    if (newStage === 0) {
      const oldStageData = affliction.stages[affliction.currentStage - 1];

      if (token) {
        await AfflictionStore.removeAffliction(token, affliction.id);
        await this.removeStageEffects(token, affliction, oldStageData, null);
        const { VisualService } = await import('./VisualService.js');
        await VisualService.removeAfflictionIndicator(token);
      } else if (actor) {
        await AfflictionStore.removeAfflictionForActor(actor, affliction.id);
      }

      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.RECOVERED', {
        tokenName: entityName,
        afflictionName: affliction.name
      }));
      return;
    }

    if (!affliction.stages || affliction.stages.length === 0) {
      ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.NO_STAGES_DEFINED', { name: affliction.name }));
      return;
    }

    let finalStage = newStage;
    if (newStage > affliction.stages.length) {
      ui.notifications.error(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MAX_STAGE', {
        tokenName: entityName,
        afflictionName: affliction.name
      }));
      finalStage = affliction.stages.length;
    }

    const oldStageData = affliction.stages[affliction.currentStage - 1];
    const newStageData = affliction.stages[finalStage - 1];

    const updates = {
      currentStage: finalStage,
      treatmentBonus: 0,
      treatedThisStage: false,
      virulentConsecutiveSuccesses: newVirulentConsecutiveSuccesses
    };

    if (affliction.needsInitialSave) {
      updates.needsInitialSave = false;
    }

    if (affliction.inOnset && finalStage > 0) {
      updates.inOnset = false;
      updates.onsetRemaining = 0;
      updates.durationElapsed = 0;
    }

    if (newStageData) {
      const stageDurationCopy = newStageData.duration ? { ...newStageData.duration } : null;
      if (combat) {
        const durationSeconds = await AfflictionParser.resolveStageDuration(stageDurationCopy, `${affliction.name} Stage ${finalStage}`);
        const durationRounds = Math.ceil(durationSeconds / 6);
        updates.nextSaveRound = combat.round + durationRounds;
        updates.nextSaveInitiative = this.getSaveInitiative(affliction, token, combat);
        updates.stageStartRound = combat.round;
      } else {
        const durationSeconds = await AfflictionParser.resolveStageDuration(stageDurationCopy, `${affliction.name} Stage ${finalStage}`);
        updates.nextSaveTimestamp = game.time.worldTime + durationSeconds;
      }
      if (stageDurationCopy?.value > 0) {
        updates.currentStageResolvedDuration = { value: stageDurationCopy.value, unit: stageDurationCopy.unit };
      }
    }

    if (newStageData?.effectInterval) {
      updates.effectIntervalElapsed = 0;
      const effectIntervalSeconds = AfflictionParser.durationToSeconds(newStageData.effectInterval);
      if (combat) {
        const effectRounds = Math.ceil(effectIntervalSeconds / 6);
        updates.nextEffectRound = combat.round + effectRounds;
      } else {
        updates.nextEffectTimestamp = game.time.worldTime + effectIntervalSeconds;
      }
    } else {
      updates.effectIntervalElapsed = 0;
      updates.nextEffectRound = null;
      updates.nextEffectTimestamp = null;
    }

    if (token) {
      await AfflictionStore.updateAffliction(token, affliction.id, updates);
    } else if (actor) {
      await AfflictionStore.updateAfflictionForActor(actor, affliction.id, updates);
    }

    const updatedAffliction = token
      ? AfflictionStore.getAffliction(token, affliction.id)
      : AfflictionStore.getAfflictionForActor(actor, affliction.id);

    if (token) {
      await this.removeStageEffects(token, updatedAffliction, oldStageData, newStageData);

      if (newStageData) {
        await this.applyStageEffects(token, updatedAffliction, newStageData);

        if (newStageData.damage && newStageData.damage.length > 0) {
          await this.promptDamage(token, updatedAffliction, actor);
        }
      }
    } else if (actor && newStageData?.damage?.length > 0) {
      await this.promptDamage(null, updatedAffliction, actor);
    }

    if (showVirulentMessage) {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.VIRULENT_CONSECUTIVE_SUCCESS', {
        tokenName: entityName,
        afflictionName: affliction.name
      }));
    }

    const oldStage = affliction.currentStage || 0;
    if (finalStage === oldStage) {
      return;
    }

    ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.STAGE_CHANGED', {
      tokenName: entityName,
      stage: finalStage,
      afflictionName: affliction.name
    }));

    await AfflictionChatService.postStageChange(token, affliction, oldStage, finalStage, { fastRecovery: fastRecoveryApplied });
  }

  static async applyStageEffects(token, affliction, stage) {
    const actor = token?.actor;
    if (!actor || !stage) return;

    if (stage.requiresManualHandling) {
      ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MANUAL_EFFECTS', {
        tokenName: token?.name || actor?.name || 'Unknown'
      }));
      return;
    }

    if (stage.isDead) {
      await AfflictionEffectBuilder.createOrUpdateEffect(token, actor, affliction, stage);
      await AfflictionChatService.promptDeathConfirmation(token, affliction);
      return;
    }

    if (stage.autoEffects && Array.isArray(stage.autoEffects) && stage.autoEffects.length > 0) {
      for (const effectData of stage.autoEffects) {
        try {
          const effectItem = await fromUuid(effectData.uuid);
          if (effectItem && effectItem.type === 'effect') {
            const existingEffect = actor.items.find(i =>
              i.type === 'effect' &&
              i.name === effectItem.name &&
              i.flags?.['pf2e-afflictioner']?.autoAppliedEffect === true
            );

            if (!existingEffect) {
              const effectSource = effectItem.toObject();
              effectSource.flags = effectSource.flags || {};
              effectSource.flags['pf2e-afflictioner'] = {
                autoAppliedEffect: true,
                afflictionId: affliction.id,
                stageNumber: affliction.currentStage
              };

              await actor.createEmbeddedDocuments('Item', [effectSource]);
            }
          }
        } catch (error) {
          console.error('PF2e Afflictioner | Error applying auto-effect:', error);
        }
      }
    }

    await AfflictionEffectBuilder.removePersistentDamage(actor, affliction.id);

    const effectUuid = token ? await AfflictionEffectBuilder.createOrUpdateEffect(token, actor, affliction, stage) : null;
    if (effectUuid && !affliction.appliedEffectUuid) {
      if (token) {
        await AfflictionStore.updateAffliction(token, affliction.id, {
          appliedEffectUuid: effectUuid
        });
      }
    }

    await AfflictionEffectBuilder.applyPersistentConditions(actor, affliction, stage);
    await AfflictionEffectBuilder.applyPersistentDamage(actor, affliction, stage);
  }

  static async removeStageEffects(token, affliction, oldStageData = null, newStageData = null) {
    const actor = token?.actor;
    if (!actor) return;

    if (!newStageData) {
      let effectRemoved = false;

      if (affliction.appliedEffectUuid) {
        try {
          const effect = await fromUuid(affliction.appliedEffectUuid);
          if (effect) {
            await effect.delete();
            effectRemoved = true;
          }
        } catch (error) {
          console.warn('PF2e Afflictioner | Could not remove effect by UUID:', error);
        }
      }

      if (!effectRemoved) {
        try {
          const effects = actor.itemTypes.effect.filter(e =>
            e.flags['pf2e-afflictioner']?.afflictionId === affliction.id
          );

          for (const effect of effects) {
            await effect.delete();
          }
        } catch (error) {
          console.error('PF2e Afflictioner | Error removing effect by flag search:', error);
        }
      }
    }

    if (affliction.treatmentEffectUuid) {
      try {
        const treatmentEffect = await fromUuid(affliction.treatmentEffectUuid);
        if (treatmentEffect) {
          await treatmentEffect.delete();
        }
      } catch (error) {
        console.error('PF2e Afflictioner | Error removing treatment effect:', error);
      }
    }

    if (oldStageData && oldStageData.autoEffects && Array.isArray(oldStageData.autoEffects)) {
      for (const effectData of oldStageData.autoEffects) {
        try {
          const autoEffects = actor.itemTypes.effect.filter(e =>
            e.flags?.['pf2e-afflictioner']?.autoAppliedEffect === true &&
            e.flags?.['pf2e-afflictioner']?.afflictionId === affliction.id &&
            (e.flags?.['pf2e-afflictioner']?.stageNumber === affliction.currentStage ||
              e.name === effectData.name)
          );

          for (const effect of autoEffects) {
            await effect.delete();
          }
        } catch (error) {
          console.error('PF2e Afflictioner | Error removing auto-effect:', error);
        }
      }
    }

    const oldStage = oldStageData || affliction.stages[affliction.currentStage - 1];
    if (!oldStage) return;

    await AfflictionEffectBuilder.removePersistentDamage(actor, affliction.id);
  }

  static async updateOnsetTimers(token, combat) {
    await AfflictionTimerService.updateOnsetTimers(token, combat, this);
  }

  static async checkDurations(token, combat) {
    await AfflictionTimerService.checkDurations(token, combat);
  }

  static async checkEffectIntervals(token, combat) {
    await AfflictionTimerService.checkEffectIntervals(token, combat, this);
  }

  static async checkWorldTimeMaxDuration(token, affliction, deltaSeconds) {
    return await AfflictionTimerService.checkWorldTimeMaxDuration(token, affliction, deltaSeconds);
  }

  static async checkWorldTimeSave(token, affliction, deltaSeconds) {
    await AfflictionTimerService.checkWorldTimeSave(token, affliction, deltaSeconds, this);
  }

  static async checkWorldTimeEffectInterval(token, affliction, deltaSeconds) {
    await AfflictionTimerService.checkWorldTimeEffectInterval(token, affliction, deltaSeconds, this);
  }

  static async checkWorldTimeOnsetEffectInterval(token, affliction, deltaSeconds) {
    await AfflictionTimerService.checkWorldTimeOnsetEffectInterval(token, affliction, deltaSeconds, this);
  }

  static _buildExpirationData(affliction, stage, token) {
    return AfflictionTimerService.buildExpirationData(affliction, stage, token);
  }

  static async handlePoisonReExposure(token, existingAffliction, stageIncrease, actor = null) {
    actor = actor || token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    const newStage = Math.min(
      existingAffliction.currentStage + stageIncrease,
      existingAffliction.stages.length
    );

    if (newStage === existingAffliction.currentStage) {
      ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MAX_STAGE', { tokenName: entityName, afflictionName: existingAffliction.name }));
      return;
    }

    const oldStageData = existingAffliction.stages[existingAffliction.currentStage - 1];
    const newStageData = existingAffliction.stages[newStage - 1];

    const updates = {
      currentStage: newStage
    };

    if (token) {
      await AfflictionStore.updateAffliction(token, existingAffliction.id, updates);
    } else if (actor) {
      await AfflictionStore.updateAfflictionForActor(actor, existingAffliction.id, updates);
    }

    const updatedAffliction = token
      ? AfflictionStore.getAffliction(token, existingAffliction.id)
      : AfflictionStore.getAfflictionForActor(actor, existingAffliction.id);

    if (token) {
      await this.removeStageEffects(token, updatedAffliction, oldStageData, newStageData);
      if (newStageData) {
        await this.applyStageEffects(token, updatedAffliction, newStageData);

        if (newStageData.damage && newStageData.damage.length > 0) {
          await this.promptDamage(token, updatedAffliction);
        }
      }
    }

    ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.POISON_RE_EXPOSURE', {
      tokenName: entityName,
      afflictionName: existingAffliction.name,
      stageIncrease: stageIncrease
    }));

    await AfflictionChatService.postPoisonReExposure(token, existingAffliction, stageIncrease, newStage);
  }

  static findExistingAffliction(token, afflictionName) {
    const afflictions = AfflictionStore.getAfflictions(token);

    for (const [_id, affliction] of Object.entries(afflictions)) {
      if (affliction.name === afflictionName) {
        return affliction;
      }
    }

    return null;
  }

  static findExistingAfflictionForActor(actor, afflictionName) {
    const afflictions = AfflictionStore.getAfflictionsForActor(actor);

    for (const [_id, affliction] of Object.entries(afflictions)) {
      if (affliction.name === afflictionName) {
        return affliction;
      }
    }

    return null;
  }

  static async handleMultipleExposure(token, existingAffliction, afflictionData, actor = null) {
    actor = actor || token?.actor;
    const entityName = token?.name || actor?.name || 'Unknown';
    const multipleExposure = afflictionData.multipleExposure;

    if (multipleExposure.minStage !== null && existingAffliction.currentStage < multipleExposure.minStage) {
      ui.notifications.info(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MULTIPLE_EXPOSURE_NO_EFFECT', {
        tokenName: entityName,
        afflictionName: afflictionData.name,
        minStage: multipleExposure.minStage
      }));
      return;
    }

    const newStage = Math.min(
      existingAffliction.currentStage + multipleExposure.stageIncrease,
      existingAffliction.stages.length
    );

    const oldStageData = existingAffliction.stages[existingAffliction.currentStage - 1];
    const newStageData = existingAffliction.stages[newStage - 1];

    const combat = game.combat;

    const updates = {
      currentStage: newStage,
      stageStartRound: combat ? combat.round : existingAffliction.stageStartRound
    };

    if (newStageData) {
      const stageDurationCopy = newStageData.duration ? { ...newStageData.duration } : null;
      if (combat) {
        const durationSeconds = await AfflictionParser.resolveStageDuration(stageDurationCopy, `${existingAffliction.name} Stage ${newStage}`);
        const durationRounds = Math.ceil(durationSeconds / 6);
        updates.nextSaveRound = combat.round + durationRounds;
        updates.nextSaveInitiative = this.getSaveInitiative(existingAffliction, token, combat);
      } else {
        const durationSeconds = await AfflictionParser.resolveStageDuration(stageDurationCopy, `${existingAffliction.name} Stage ${newStage}`);
        updates.nextSaveTimestamp = game.time.worldTime + durationSeconds;
      }
      if (stageDurationCopy?.value > 0) {
        updates.currentStageResolvedDuration = { value: stageDurationCopy.value, unit: stageDurationCopy.unit };
      }
    }

    if (token) {
      await AfflictionStore.updateAffliction(token, existingAffliction.id, updates);
    } else if (actor) {
      await AfflictionStore.updateAfflictionForActor(actor, existingAffliction.id, updates);
    }

    const updatedAffliction = token
      ? AfflictionStore.getAffliction(token, existingAffliction.id)
      : AfflictionStore.getAfflictionForActor(actor, existingAffliction.id);

    if (token) {
      await this.removeStageEffects(token, updatedAffliction, oldStageData, newStageData);
      if (newStageData) {
        await this.applyStageEffects(token, updatedAffliction, newStageData);

        if (newStageData.damage && newStageData.damage.length > 0) {
          await this.promptDamage(token, updatedAffliction);
        }
      }
    }

    ui.notifications.warn(game.i18n.format('PF2E_AFFLICTIONER.NOTIFICATIONS.MULTIPLE_EXPOSURE', {
      tokenName: entityName,
      afflictionName: afflictionData.name,
      stageIncrease: multipleExposure.stageIncrease,
      newStage: newStage
    }));

    await AfflictionChatService.postMultipleExposure(token, afflictionData, multipleExposure, newStage);
  }

  static getSaveInitiative(affliction, token, combat) {
    const useAppInit = game.settings.get(MODULE_ID, 'useApplicationInitiative');
    if (useAppInit && affliction.applicationInitiative != null) {
      return affliction.applicationInitiative;
    }
    return combat?.combatants?.find(c => c.tokenId === token?.id)?.initiative ?? null;
  }

  static getDieValue(rollOrMessage) {
    if (!rollOrMessage) return null;

    const roll = rollOrMessage.rolls ? rollOrMessage.rolls[0] : rollOrMessage;
    if (!roll) return null;

    const d20Die = roll.dice?.find(d => d.faces === 20);
    if (d20Die?.results?.length > 0) {
      return d20Die.results[0].result;
    }

    const d20Term = roll.terms?.find(t => t.faces === 20);
    if (d20Term?.results?.length > 0) {
      return d20Term.results[0].result;
    }

    return null;
  }

  static calculateDegreeOfSuccess(total, dc, dieValue = null) {
    const diff = total - dc;
    let degree;
    if (diff >= 10) degree = DEGREE_OF_SUCCESS.CRITICAL_SUCCESS;
    else if (diff >= 0) degree = DEGREE_OF_SUCCESS.SUCCESS;
    else if (diff >= -10) degree = DEGREE_OF_SUCCESS.FAILURE;
    else degree = DEGREE_OF_SUCCESS.CRITICAL_FAILURE;

    if (dieValue === 20) {
      if (degree === DEGREE_OF_SUCCESS.FAILURE) degree = DEGREE_OF_SUCCESS.SUCCESS;
      else if (degree === DEGREE_OF_SUCCESS.SUCCESS) degree = DEGREE_OF_SUCCESS.CRITICAL_SUCCESS;
      else if (degree === DEGREE_OF_SUCCESS.CRITICAL_FAILURE) degree = DEGREE_OF_SUCCESS.FAILURE;
    } else if (dieValue === 1) {
      if (degree === DEGREE_OF_SUCCESS.SUCCESS) degree = DEGREE_OF_SUCCESS.FAILURE;
      else if (degree === DEGREE_OF_SUCCESS.CRITICAL_SUCCESS) degree = DEGREE_OF_SUCCESS.SUCCESS;
      else if (degree === DEGREE_OF_SUCCESS.FAILURE) degree = DEGREE_OF_SUCCESS.CRITICAL_FAILURE;
    }

    return degree;
  }
}
