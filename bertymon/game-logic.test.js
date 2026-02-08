/**
 * Bertymon Game Logic Tests
 */

const {
    MOVES,
    BERTYMON_TEMPLATES,
    createBertymon,
    getTypeEffectiveness,
    getStatWithStages,
    calculateDamage,
    getRivalStarter,
    applyMoveEffect
} = require('./game-logic');

describe('MOVES Data Structure', () => {
    test('should have 6 moves defined', () => {
        expect(Object.keys(MOVES).length).toBe(6);
    });

    test('should have Leafage move', () => {
        expect(MOVES.Leafage).toEqual({
            name: "Leafage",
            type: "Grass",
            power: 50,
            effect: null
        });
    });

    test('should have status move Leer', () => {
        expect(MOVES.Leer).toEqual({
            name: "Leer",
            type: "Normal",
            power: null,
            effect: "lowerDefense1"
        });
    });

    test('all moves should have name and type', () => {
        Object.values(MOVES).forEach(move => {
            expect(move.name).toBeDefined();
            expect(move.type).toBeDefined();
        });
    });
});

describe('BERTYMON_TEMPLATES Data Structure', () => {
    test('should have 3 starter templates', () => {
        expect(Object.keys(BERTYMON_TEMPLATES).length).toBe(3);
    });

    test('should have Treebeast template', () => {
        expect(BERTYMON_TEMPLATES.Treebeast.name).toBe("Treebeast");
        expect(BERTYMON_TEMPLATES.Treebeast.type).toBe("Grass");
        expect(BERTYMON_TEMPLATES.Treebeast.hp).toBe(100);
        expect(BERTYMON_TEMPLATES.Treebeast.speed).toBe(45);
    });

    test('should have Flarepup template', () => {
        expect(BERTYMON_TEMPLATES.Flarepup.name).toBe("Flarepup");
        expect(BERTYMON_TEMPLATES.Flarepup.type).toBe("Fire");
        expect(BERTYMON_TEMPLATES.Flarepup.speed).toBe(55);
    });

    test('should have Aquawing template', () => {
        expect(BERTYMON_TEMPLATES.Aquawing.name).toBe("Aquawing");
        expect(BERTYMON_TEMPLATES.Aquawing.type).toBe("Water");
        expect(BERTYMON_TEMPLATES.Aquawing.speed).toBe(50);
    });

    test('all templates should have required properties', () => {
        Object.values(BERTYMON_TEMPLATES).forEach(template => {
            expect(template.name).toBeDefined();
            expect(template.type).toBeDefined();
            expect(template.sprite).toBeDefined();
            expect(template.hp).toBe(100);
            expect(template.attack).toBe(50);
            expect(template.defense).toBe(50);
            expect(Array.isArray(template.moves)).toBe(true);
        });
    });
});

describe('createBertymon()', () => {
    test('should create Treebeast with correct stats', () => {
        const bmon = createBertymon("Treebeast");
        expect(bmon.name).toBe("Treebeast");
        expect(bmon.type).toBe("Grass");
        expect(bmon.hp).toBe(100);
        expect(bmon.maxHp).toBe(100);
        expect(bmon.attack).toBe(50);
        expect(bmon.defense).toBe(50);
        expect(bmon.speed).toBe(45);
    });

    test('should have initial stat stages at 0', () => {
        const bmon = createBertymon("Flarepup");
        expect(bmon.statStages.attack).toBe(0);
        expect(bmon.statStages.defense).toBe(0);
    });

    test('should have moves array', () => {
        const bmon = createBertymon("Aquawing");
        expect(Array.isArray(bmon.moves)).toBe(true);
        expect(bmon.moves.length).toBe(3);
    });

    test('should create independent instances', () => {
        const bmon1 = createBertymon("Treebeast");
        const bmon2 = createBertymon("Treebeast");

        bmon1.hp = 50;
        bmon1.moves.push("Synthesis");

        expect(bmon2.hp).toBe(100);
        expect(bmon2.moves.length).toBe(3);
    });

    test('should throw error for unknown template', () => {
        expect(() => createBertymon("UnknownBertymon")).toThrow();
    });
});

describe('getTypeEffectiveness()', () => {
    test('should return 2 for super effective', () => {
        expect(getTypeEffectiveness("Grass", "Water")).toBe(2);
        expect(getTypeEffectiveness("Water", "Fire")).toBe(2);
        expect(getTypeEffectiveness("Fire", "Grass")).toBe(2);
    });

    test('should return 0.5 for not very effective', () => {
        expect(getTypeEffectiveness("Grass", "Fire")).toBe(0.5);
        expect(getTypeEffectiveness("Water", "Grass")).toBe(0.5);
        expect(getTypeEffectiveness("Fire", "Water")).toBe(0.5);
    });

    test('should return 1 for neutral matchups', () => {
        expect(getTypeEffectiveness("Grass", "Grass")).toBe(1);
        expect(getTypeEffectiveness("Normal", "Water")).toBe(1);
        expect(getTypeEffectiveness("Water", "Water")).toBe(1);
        expect(getTypeEffectiveness("Fire", "Fire")).toBe(1);
    });

    test('should return 1 for Normal type', () => {
        expect(getTypeEffectiveness("Normal", "Grass")).toBe(1);
        expect(getTypeEffectiveness("Normal", "Fire")).toBe(1);
        expect(getTypeEffectiveness("Normal", "Water")).toBe(1);
    });
});

describe('getStatWithStages()', () => {
    test('should return base stat when stage is 0', () => {
        expect(getStatWithStages(50, 0)).toBe(50);
        expect(getStatWithStages(100, 0)).toBe(100);
    });

    test('should increase stat for positive stages', () => {
        // Formula: baseStat * (2 + stage) / 2
        expect(getStatWithStages(50, 1)).toBe(75);  // 50 * 3/2 = 75
        expect(getStatWithStages(50, 2)).toBe(100); // 50 * 4/2 = 100
        expect(getStatWithStages(50, 3)).toBe(125); // 50 * 5/2 = 125
    });

    test('should decrease stat for negative stages', () => {
        // Formula: baseStat * 2 / (2 + |stage|)
        expect(getStatWithStages(50, -1)).toBe(33);  // 50 * 2/3 = 33.33 -> 33
        expect(getStatWithStages(50, -2)).toBe(25);  // 50 * 2/4 = 25
        expect(getStatWithStages(100, -1)).toBe(66); // 100 * 2/3 = 66.66 -> 66
    });

    test('should floor result to integer', () => {
        // 50 * 2 / 3 = 33.333... should be 33
        expect(getStatWithStages(50, -1) % 1).toBe(0);
        expect(Number.isInteger(getStatWithStages(50, -1))).toBe(true);
    });

    test('should handle max stage (+6)', () => {
        const stat = getStatWithStages(50, 6);
        expect(stat).toBe(200); // 50 * 8/2 = 200
    });

    test('should handle min stage (-6)', () => {
        const stat = getStatWithStages(50, -6);
        expect(stat).toBe(12); // 50 * 2 / (2 + 6) = 100 / 8 = 12.5 -> 12
    });
});

describe('calculateDamage()', () => {
    test('should calculate damage with same type', () => {
        const attacker = createBertymon("Treebeast");
        const defender = createBertymon("Treebeast");
        const move = MOVES.Leafage;

        const result = calculateDamage(move, attacker, defender);

        expect(result.damage).toBeGreaterThanOrEqual(1);
        expect(result.effectiveness).toBe(1);
    });

    test('should calculate super effective damage', () => {
        const attacker = createBertymon("Treebeast"); // Grass
        const defender = createBertymon("Aquawing");   // Water
        const move = MOVES.Leafage;                    // Grass type

        const result = calculateDamage(move, attacker, defender);

        expect(result.effectiveness).toBe(2);
        expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    test('should calculate not very effective damage', () => {
        const attacker = createBertymon("Treebeast"); // Grass
        const defender = createBertymon("Flarepup");   // Fire
        const move = MOVES.Leafage;                    // Grass type

        const result = calculateDamage(move, attacker, defender);

        expect(result.effectiveness).toBe(0.5);
        expect(result.damage).toBeGreaterThanOrEqual(1);
    });

    test('should respect stat stages in damage calculation', () => {
        const attacker = createBertymon("Treebeast");
        const defender = createBertymon("Flarepup");
        const move = MOVES.Leafage;

        // Normal damage
        const normalResult = calculateDamage(move, attacker, defender);

        // Increase attacker's attack
        attacker.statStages.attack = 1;
        const boostedResult = calculateDamage(move, attacker, defender);

        expect(boostedResult.damage).toBeGreaterThan(normalResult.damage);
    });

    test('should throw error for status moves', () => {
        const attacker = createBertymon("Treebeast");
        const defender = createBertymon("Flarepup");
        const move = MOVES.Leer; // Status move

        expect(() => calculateDamage(move, attacker, defender)).toThrow();
    });

    test('damage should always be at least 1', () => {
        const attacker = createBertymon("Treebeast");
        const defender = createBertymon("Flarepup");
        const move = MOVES.QuickAttack;

        for (let i = 0; i < 100; i++) {
            const result = calculateDamage(move, attacker, defender);
            expect(result.damage).toBeGreaterThanOrEqual(1);
        }
    });
});

describe('getRivalStarter()', () => {
    test('should return Flarepup if player chooses Treebeast', () => {
        expect(getRivalStarter("Treebeast")).toBe("Flarepup");
    });

    test('should return Aquawing if player chooses Flarepup', () => {
        expect(getRivalStarter("Flarepup")).toBe("Aquawing");
    });

    test('should return Treebeast if player chooses Aquawing', () => {
        expect(getRivalStarter("Aquawing")).toBe("Treebeast");
    });

    test('should form type-advantage rock-paper-scissors', () => {
        // Flarepup (Fire) beats Treebeast (Grass)
        expect(getTypeEffectiveness("Fire", "Grass")).toBe(2);
        // Aquawing (Water) beats Flarepup (Fire)
        expect(getTypeEffectiveness("Water", "Fire")).toBe(2);
        // Treebeast (Grass) beats Aquawing (Water)
        expect(getTypeEffectiveness("Grass", "Water")).toBe(2);
    });

    test('should throw error for unknown starter', () => {
        expect(() => getRivalStarter("UnknownBertymon")).toThrow();
    });
});

describe('applyMoveEffect()', () => {
    test('should lower defense for lowerDefense1 effect', () => {
        const target = createBertymon("Treebeast");
        expect(target.statStages.defense).toBe(0);

        applyMoveEffect(MOVES.Leer, target);

        expect(target.statStages.defense).toBe(-1);
    });

    test('should lower attack for lowerAttack1 effect', () => {
        const target = createBertymon("Treebeast");
        expect(target.statStages.attack).toBe(0);

        applyMoveEffect(MOVES.TailWag, target);

        expect(target.statStages.attack).toBe(-1);
    });

    test('should stack multiple applications', () => {
        const target = createBertymon("Treebeast");

        applyMoveEffect(MOVES.Leer, target);
        applyMoveEffect(MOVES.Leer, target);
        applyMoveEffect(MOVES.Leer, target);

        expect(target.statStages.defense).toBe(-3);
    });

    test('should not go below -6', () => {
        const target = createBertymon("Treebeast");

        for (let i = 0; i < 10; i++) {
            applyMoveEffect(MOVES.Leer, target);
        }

        expect(target.statStages.defense).toBe(-6);
    });

    test('should not affect unrelated stats', () => {
        const target = createBertymon("Treebeast");
        const originalAttack = target.statStages.attack;

        applyMoveEffect(MOVES.Leer, target);

        expect(target.statStages.attack).toBe(originalAttack);
    });
});

describe('Integration Tests', () => {
    test('full battle scenario: Treebeast vs Flarepup', () => {
        const player = createBertymon("Treebeast");
        const rival = createBertymon("Flarepup");

        const playerMove = MOVES.Leafage;
        const rivalMove = MOVES.Ember;

        // Player attacks (Grass vs Fire = not very effective)
        const playerDamage = calculateDamage(playerMove, player, rival);
        expect(playerDamage.effectiveness).toBe(0.5);

        rival.hp = Math.max(0, rival.hp - playerDamage.damage);
        expect(rival.hp).toBeLessThan(100);
        expect(rival.hp).toBeGreaterThanOrEqual(0);

        // Rival attacks (Fire vs Grass = super effective)
        const rivalDamage = calculateDamage(rivalMove, rival, player);
        expect(rivalDamage.effectiveness).toBe(2);

        player.hp = Math.max(0, player.hp - rivalDamage.damage);
        expect(player.hp).toBeLessThan(100);
        expect(player.hp).toBeGreaterThanOrEqual(0);
    });

    test('stat modifications affect damage', () => {
        const attacker = createBertymon("Treebeast");
        const defender = createBertymon("Aquawing");
        const move = MOVES.Leafage;

        // Normal damage
        const baseDamage = calculateDamage(move, attacker, defender);

        // Lower defender's defense
        applyMoveEffect(MOVES.Leer, defender);
        const damageBoosted = calculateDamage(move, attacker, defender);

        // Damage should be higher now
        expect(damageBoosted.damage).toBeGreaterThan(baseDamage.damage);
    });

    test('all starters can be created and used', () => {
        const starters = ["Treebeast", "Flarepup", "Aquawing"];

        starters.forEach(starterName => {
            const player = createBertymon(starterName);
            const rival = createBertymon(getRivalStarter(starterName));

            expect(player.name).toBe(starterName);
            expect(rival.hp).toBe(100);
            expect(player.moves.length).toBe(3);

            // Test attacking
            const move = MOVES[player.moves[0]];
            if (move.power !== null) {
                const damage = calculateDamage(move, player, rival);
                expect(damage.damage).toBeGreaterThanOrEqual(1);
            }
        });
    });
});
