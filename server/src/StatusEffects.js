
const EventsList = require('./EventsList');
const Utils = require('./Utils');

class StatusEffect {
    /**
     *
     * @param {Character} entity
     * @param {*} source
     */
    constructor (entity, source) {
        this.appliedTo = entity;
        this.source = source || null;
        this.effectName = this.constructor.name;

        this.start();
    }

    start () {
        if(this.shouldStart() === false){
            return;
        }

        if(this.appliedTo.hitPoints < 1) return;
        // Check if this kind of status effect is already active on this entity.
        if(this.appliedTo.statusEffects[this.effectName] !== undefined){
            this.appliedTo.statusEffects[this.effectName].stop();
        }
        // Add this new status effect.
        this.appliedTo.statusEffects[this.effectName] = this;

        // Set the duration to be the default for new effects.
        this._effectsRemaining = this._startingEffectsRemaining;
        // If the effect should activate right away, do the effect.
        if(this._effectOnStart === true){
            this._effect();
        }
        // Clear the existing effect loop, or the loops will be stacked (and there won't be a reference to the stacked ones to stop them manually).
        clearTimeout(this._effectLoop);
        // Start the effect loop.
        this._effectLoop = setTimeout(this._effect.bind(this), this._effectRate);
        // Tell nearby players the effect has been applied.
        this.appliedTo.board.emitToNearbyPlayers(this.appliedTo.row, this.appliedTo.col, this._startEffectEventName, this.appliedTo.id);
    }

    _effect () {
        if(this.shouldContinueEffect() === false){
            this.stop();
            return;
        }
        // If this effect changes the hitpoint of what it is applied to, mod the hitpoints.
        if(this._modHitpointsOnEffect !== 0){
            if(this._modHitpointsOnEffect < 0){
                this.appliedTo.damage(-this._modHitpointsOnEffect, this.source);
            }
            else {
                this.appliedTo.modHitPoints(this._modHitpointsOnEffect, this.source);
            }
        }
        this._effectsRemaining -= 1;
        // Check if the effect duration is over.
        if(this._effectsRemaining < 1){
            if(this.shouldStop() === true){
                this.stop();
                return;
            }
        }
        // Keep going with the effect loop.
        this._effectLoop = setTimeout(this._effect.bind(this), this._effectRate);
    }

    stop () {
        this._effectsRemaining = 0;
        // Stop the loop.
        clearTimeout(this._effectLoop);
        // Remove this effect from the thing it is applied to.
        delete this.appliedTo.statusEffects[this.effectName];
        // Don't send if they are already dead.
        if(this.appliedTo.hitPoints > 0){
            this.appliedTo.board.emitToNearbyPlayers(this.appliedTo.row, this.appliedTo.col, this._stopEffectEventName, this.appliedTo.id);
        }
    }

    shouldStart () {
        return true;
    }

    shouldStop () {
        return true;
    }

    shouldContinueEffect () {
        return true;
    }

}
/** @type {String} The name of this effect, to be used as an ID in any lists of status effects. */
StatusEffect.prototype.effectName = '';
/** @type {Boolean} Should the effect by activated on start. */
StatusEffect.prototype._effectOnStart = false;
/** @type {Number} How much to modify the hitpoints of the thing it is applied to by each effect. */
StatusEffect.prototype._modHitpointsOnEffect = 0;
/** @type {Number} How many more times will this effect happen before stopping. */
StatusEffect.prototype._effectsRemaining = 0;
/** @type {Number} How long will this effect last for when started. Starting the effect multiple times does not stack this duration. */
StatusEffect.prototype._startingEffectsRemaining = 0;
/** @type {Number} A reference to the loop of this effect. Counts down the remaining duration, and is used to stop and thus remove this status effect. */
StatusEffect.prototype._effectLoop = 0;
/** @type {Number} How long between each time the effect will be activated. */
StatusEffect.prototype._effectRate = 1000;
/** @type {String} The event name that will be sent when the effect starts. */
StatusEffect.prototype._startEffectEventName = '';
/** @type {String} The event name that will be sent when the effect stops. */
StatusEffect.prototype._stopEffectEventName = '';
/** @type {Boolean} Whether this status effect does something bad. */
StatusEffect.prototype.hazardous = false;

class Burn extends StatusEffect {

    shouldContinueEffect () {
        // If it is water, remove burning if it is applied.
        // Can't walk into deep water.
        if(this.appliedTo.board.grid[this.appliedTo.row][this.appliedTo.col].groundType === GroundTypes.ShallowWater){
            return false;
        }
    }

    shouldStop () {
        // Check if they are standing in lava.
        // If so, keep burning.
        if(this.appliedTo.board.grid[this.appliedTo.row][this.appliedTo.col].groundType.StatusEffect === Burn){
            this._effectsRemaining = this._startingEffectsRemaining;
            return false;
        }

        return true;
    }
}
Burn.prototype._effectOnStart = true;
Burn.prototype._modHitpointsOnEffect = -require('./ModHitPointValues').Burn;
Burn.prototype._startingEffectsRemaining = 3;
Burn.prototype._startEffectEventName = EventsList.effect_start_burn;
Burn.prototype._stopEffectEventName = EventsList.effect_stop_burn;
Burn.prototype.hazardous = true;

class Poison extends StatusEffect {

    shouldStart () {
        // If the target is cured, don't apply the poison effect.
        if(this.appliedTo.statusEffects[StatusEffects.Cured.name] !== undefined){
            return false;
        }

        return true;
    }

    shouldContinueEffect () {
        // If the target is cured, stop the poison effect.
        if(this.appliedTo.statusEffects[StatusEffects.Cured.name] !== undefined){
            return false;
        }

        return true;
    }

    shouldStop () {
        // Check if they are standing in poison.
        // If so, keep poisoned.
        if(this.appliedTo.board.grid[this.appliedTo.row][this.appliedTo.col].groundType.StatusEffect === Poison){
            this._effectsRemaining = this._startingEffectsRemaining;
            return false;
        }

        return true;
    }
}
Poison.prototype._modHitpointsOnEffect = -require('./ModHitPointValues').Poison;
Poison.prototype._startingEffectsRemaining = 5;
Poison.prototype._effectRate = 2000;
Poison.prototype._startEffectEventName = EventsList.effect_start_poison;
Poison.prototype._stopEffectEventName = EventsList.effect_stop_poison;
Poison.prototype.hazardous = true;

class Disease extends StatusEffect {}
Disease.prototype._modHitpointsOnEffect = -require('./ModHitPointValues').Disease;
Disease.prototype._startingEffectsRemaining = 20;
Disease.prototype._effectRate = 4000;
Disease.prototype._startEffectEventName = EventsList.effect_start_disease;
Disease.prototype._stopEffectEventName = EventsList.effect_stop_disease;
Disease.prototype.hazardous = true;

class HealthRegen extends StatusEffect {}
HealthRegen.prototype._modHitpointsOnEffect = require('./ModHitPointValues').HealthRegen;
HealthRegen.prototype._startingEffectsRemaining = 5;
HealthRegen.prototype._startEffectEventName = EventsList.effect_start_health_regen;
HealthRegen.prototype._stopEffectEventName = EventsList.effect_stop_health_regen;

class EnergyRegen extends StatusEffect {
    _effect () {
        if(this.appliedTo.modEnergy !== undefined){
            this.appliedTo.modEnergy(1);
        }
        super._effect();
    }
}
EnergyRegen.prototype._startingEffectsRemaining = 10;
EnergyRegen.prototype._startEffectEventName = EventsList.effect_start_energy_regen;
EnergyRegen.prototype._stopEffectEventName = EventsList.effect_stop_energy_regen;

class Cured extends StatusEffect {}
Cured.prototype._effectOnStart = true;
Cured.prototype._startingEffectsRemaining = 60;
Cured.prototype._startEffectEventName = EventsList.effect_start_cured;
Cured.prototype._stopEffectEventName = EventsList.effect_stop_cured;

const StatusEffects = {
    Burn: Burn,
    Poison: Poison,
    Disease: Disease,
    HealthRegen: HealthRegen,
    EnergyRegen: EnergyRegen,
    Cured: Cured
};

module.exports = StatusEffects;

const GroundTypes = require('./GroundTypes');