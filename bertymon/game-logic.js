/**
 * Bertymon Game Logic - Pure Functions
 * These functions contain no Kaplay dependencies and can be tested independently
 */

// 1a. MOVES Data Structure
const MOVES = {
    "Leafage": { name: "Leafage", type: "Grass", power: 50, effect: null },
    "Ember": { name: "Ember", type: "Fire", power: 50, effect: null },
    "WaterGun": { name: "Water Gun", type: "Water", power: 50, effect: null },
    "QuickAttack": { name: "Quick Attack", type: "Normal", power: 40, effect: null },
    "Leer": { name: "Leer", type: "Normal", power: null, effect: "lowerDefense1" },
    "TailWag": { name: "Tail Wag", type: "Normal", power: null, effect: "lowerAttack1" }
};

// 1b. BERTYMON_TEMPLATES Data Structure
const BERTYMON_TEMPLATES = {
    "Treebeast": {
        name: "Treebeast",
        type: "Grass",
        sprite: "treebeast",
        hp: 100,
        attack: 50,
        defense: 50,
        speed: 45,
        moves: ["Leafage", "QuickAttack", "Leer"]
    },
    "Flarepup": {
        name: "Flarepup",
        type: "Fire",
        sprite: "flarepup",
        hp: 100,
        attack: 50,
        defense: 50,
        speed: 55,
        moves: ["Ember", "QuickAttack", "TailWag"]
    },
    "Aquawing": {
        name: "Aquawing",
        type: "Water",
        sprite: "aquawing",
        hp: 100,
        attack: 50,
        defense: 50,
        speed: 50,
        moves: ["WaterGun", "QuickAttack", "Leer"]
    }
};

// 1c. Create a fresh Bertymon instance from template
function createBertymon(templateName) {
    const template = BERTYMON_TEMPLATES[templateName];
    if (!template) {
        throw new Error(`Unknown Bertymon template: ${templateName}`);
    }
    return {
        name: template.name,
        type: template.type,
        sprite: template.sprite,
        maxHp: template.hp,
        hp: template.hp,
        attack: template.attack,
        defense: template.defense,
        speed: template.speed,
        moves: [...template.moves],
        statStages: {
            attack: 0,
            defense: 0
        }
    };
}

// 1d. Calculate type effectiveness (2, 1, or 0.5)
function getTypeEffectiveness(attackType, defenderType) {
    // Type triangle: Grass > Water > Fire > Grass
    if (attackType === "Grass" && defenderType === "Water") return 2;
    if (attackType === "Water" && defenderType === "Fire") return 2;
    if (attackType === "Fire" && defenderType === "Grass") return 2;

    if (attackType === "Grass" && defenderType === "Fire") return 0.5;
    if (attackType === "Water" && defenderType === "Grass") return 0.5;
    if (attackType === "Fire" && defenderType === "Water") return 0.5;

    return 1;
}

// 1e. Apply stat stage modifiers
function getStatWithStages(baseStat, stage) {
    if (stage === 0) return baseStat;
    if (stage > 0) return Math.floor(baseStat * (2 + stage) / 2);
    return Math.floor(baseStat * 2 / (2 + Math.abs(stage)));
}

// 1f. Calculate damage from attack
function calculateDamage(move, attacker, defender) {
    if (move.power === null) {
        throw new Error("Cannot calculate damage for status moves");
    }

    const effectiveness = getTypeEffectiveness(move.type, defender.type);
    const attackStat = getStatWithStages(attacker.attack, attacker.statStages.attack);
    const defenseStat = getStatWithStages(defender.defense, defender.statStages.defense);

    const baseDamage = move.power * (attackStat / defenseStat) * effectiveness;
    const variance = 0.85 + Math.random() * 0.3;
    const damage = Math.max(1, Math.floor(baseDamage * variance));

    return { damage, effectiveness };
}

// 1g. Determine rival's counter-pick
function getRivalStarter(playerStarterName) {
    const counterPicks = {
        "Treebeast": "Flarepup",
        "Flarepup": "Aquawing",
        "Aquawing": "Treebeast"
    };
    const pick = counterPicks[playerStarterName];
    if (!pick) {
        throw new Error(`Unknown starter: ${playerStarterName}`);
    }
    return pick;
}

// 1h. Apply status move effects
function applyMoveEffect(move, target) {
    if (move.effect === "lowerDefense1") {
        target.statStages.defense = Math.max(-6, target.statStages.defense - 1);
    } else if (move.effect === "lowerAttack1") {
        target.statStages.attack = Math.max(-6, target.statStages.attack - 1);
    }
}

// Export for use in both Node.js (testing) and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MOVES,
        BERTYMON_TEMPLATES,
        createBertymon,
        getTypeEffectiveness,
        getStatWithStages,
        calculateDamage,
        getRivalStarter,
        applyMoveEffect
    };
}
