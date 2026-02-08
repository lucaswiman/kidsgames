# Bertymon - Testing Documentation

## Overview

The Bertymon game includes comprehensive Jest tests for all pure game logic functions. These tests ensure the correctness of the battle system's core mechanics.

## Test Setup

### Installation

All dependencies are listed in `package.json`. Install with:

```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run tests on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Coverage

### Code Coverage Statistics

```
File           | % Stmts | % Branch | % Funcs | % Lines
---
game-logic.js  |   100%  |  95.23%  |   100%  |   100%
---
Overall        |   100%  |  95.23%  |   100%  |   100%
```

**Coverage Breakdown:**
- ✅ **Statements**: 100% - All lines of code are executed
- ✅ **Functions**: 100% - All functions are tested
- ✅ **Lines**: 100% - Every line runs in tests
- ⚠️  **Branches**: 95.23% - Nearly all conditional paths tested (see uncovered lines)

### Uncovered Branches

Lines 129-135 (Node.js/CommonJS module export detection):
```javascript
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ... }
}
```

These are only needed for Node.js testing and don't execute in browser, so the missing 4.77% is acceptable.

## Test Structure

### Test File Organization

**File**: `bertymon/game-logic.test.js`

**Test Suites** (8 total):
1. MOVES Data Structure (4 tests)
2. BERTYMON_TEMPLATES Data Structure (5 tests)
3. createBertymon() (5 tests)
4. getTypeEffectiveness() (4 tests)
5. getStatWithStages() (6 tests)
6. calculateDamage() (6 tests)
7. getRivalStarter() (5 tests)
8. applyMoveEffect() (5 tests)
9. Integration Tests (3 tests)

**Total**: 43 tests, all passing ✅

## What's Tested

### 1. MOVES Data Structure (4 tests)

```javascript
✓ should have 6 moves defined
✓ should have Leafage move
✓ should have status move Leer
✓ all moves should have name and type
```

**Validates**: Move definitions are complete and correctly structured.

### 2. BERTYMON_TEMPLATES Data Structure (5 tests)

```javascript
✓ should have 3 starter templates
✓ should have Treebeast template
✓ should have Flarepup template
✓ should have Aquawing template
✓ all templates should have required properties
```

**Validates**: All three starters are defined with correct stats and moves.

### 3. createBertymon() (5 tests)

```javascript
✓ should create Treebeast with correct stats
✓ should have initial stat stages at 0
✓ should have moves array
✓ should create independent instances
✓ should throw error for unknown template
```

**Validates**:
- Instances are created with correct initial values
- HP, stats, and speed are properly set
- Each instance is independent (no shared references)
- Error handling for invalid templates

### 4. getTypeEffectiveness() (4 tests)

```javascript
✓ should return 2 for super effective
✓ should return 0.5 for not very effective
✓ should return 1 for neutral matchups
✓ should return 1 for Normal type
```

**Validates**: Type triangle mechanic:
- Grass > Water > Fire > Grass
- Normal type is neutral against all types

### 5. getStatWithStages() (6 tests)

```javascript
✓ should return base stat when stage is 0
✓ should increase stat for positive stages
✓ should decrease stat for negative stages
✓ should floor result to integer
✓ should handle max stage (+6)
✓ should handle min stage (-6)
```

**Validates**:
- Stat calculation formulas:
  - Positive: `baseStat * (2 + stage) / 2`
  - Negative: `baseStat * 2 / (2 + |stage|)`
- Results are always floored to integers
- Extreme stage values (+6, -6) are handled

### 6. calculateDamage() (6 tests)

```javascript
✓ should calculate damage with same type
✓ should calculate super effective damage
✓ should calculate not very effective damage
✓ should respect stat stages in damage calculation
✓ should throw error for status moves
✓ damage should always be at least 1
```

**Validates**:
- Base damage formula
- Type effectiveness multipliers applied correctly
- Stat stages affect damage properly
- Status moves are rejected with error
- Minimum damage is 1 (never 0 or negative)
- Variance in damage calculation (0.85x to 1.15x)

### 7. getRivalStarter() (5 tests)

```javascript
✓ should return Flarepup if player chooses Treebeast
✓ should return Aquawing if player chooses Flarepup
✓ should return Treebeast if player chooses Aquawing
✓ should form type-advantage rock-paper-scissors
✓ should throw error for unknown starter
```

**Validates**:
- Rival always picks a Bertymon that has type advantage
- Counter-pick logic follows rock-paper-scissors pattern
- Error handling for invalid choices

### 8. applyMoveEffect() (5 tests)

```javascript
✓ should lower defense for lowerDefense1 effect
✓ should lower attack for lowerAttack1 effect
✓ should stack multiple applications
✓ should not go below -6
✓ should not affect unrelated stats
```

**Validates**:
- Status move effects are applied correctly
- Effects stack when applied multiple times
- Stage minimum is enforced at -6
- Only intended stats are affected

### 9. Integration Tests (3 tests)

```javascript
✓ full battle scenario: Treebeast vs Flarepup
✓ stat modifications affect damage
✓ all starters can be created and used
```

**Validates**: Real-world battle scenarios work correctly with all components together.

## Test Examples

### Example 1: Type Effectiveness

```javascript
test('should return 2 for super effective', () => {
    expect(getTypeEffectiveness("Grass", "Water")).toBe(2);
    expect(getTypeEffectiveness("Water", "Fire")).toBe(2);
    expect(getTypeEffectiveness("Fire", "Grass")).toBe(2);
});
```

### Example 2: Damage Calculation

```javascript
test('should calculate super effective damage', () => {
    const attacker = createBertymon("Treebeast"); // Grass
    const defender = createBertymon("Aquawing");   // Water
    const move = MOVES.Leafage;                    // Grass type

    const result = calculateDamage(move, attacker, defender);

    expect(result.effectiveness).toBe(2);
    expect(result.damage).toBeGreaterThanOrEqual(1);
});
```

### Example 3: Stat Stages

```javascript
test('should increase stat for positive stages', () => {
    // Formula: baseStat * (2 + stage) / 2
    expect(getStatWithStages(50, 1)).toBe(75);  // 50 * 3/2 = 75
    expect(getStatWithStages(50, 2)).toBe(100); // 50 * 4/2 = 100
    expect(getStatWithStages(50, 3)).toBe(125); // 50 * 5/2 = 125
});
```

## Game Logic Module

### Location
`bertymon/game-logic.js`

### Exported Functions
- `createBertymon(templateName)` - Creates a Bertymon instance
- `getTypeEffectiveness(attackType, defenderType)` - Returns effectiveness multiplier
- `getStatWithStages(baseStat, stage)` - Applies stat stage modifiers
- `calculateDamage(move, attacker, defender)` - Calculates damage
- `getRivalStarter(playerStarterName)` - Gets rival's counter-pick
- `applyMoveEffect(move, target)` - Applies status move effects

### Exported Constants
- `MOVES` - Move definitions
- `BERTYMON_TEMPLATES` - Starter Bertymon templates

### Usage in Game

The game UI (`game.js`) uses these exported functions. To integrate game-logic.js into the browser version, it checks for a module environment and exports accordingly.

## Continuous Testing

### Watch Mode

For development, use watch mode to auto-run tests on file changes:

```bash
npm run test:watch
```

This is useful when:
- Implementing new game mechanics
- Bug fixing
- Refactoring pure functions

### Coverage Tracking

Run coverage reports regularly to ensure quality:

```bash
npm run test:coverage
```

Aim to maintain >95% coverage for critical game logic.

## What's NOT Tested (Intentionally)

The following are intentionally not tested (Kaplay dependencies):

- **Battle scene rendering** - Requires Kaplay (canvas library)
- **UI button interactions** - Requires DOM and Kaplay
- **Game state management** - Tested implicitly through integration tests
- **Async operations** - `wait()`, scene transitions (Kaplay-specific)

These would require:
- Full Kaplay setup in tests
- Browser environment (JSDOM)
- Additional complexity

Instead, we focus on testable pure functions that contain the core game logic.

## Future Test Improvements

### Potential Additions

1. **Test game-logic integration with game.js**
   - Requires Kaplay mock or JSDOM
   - Would test battle loop end-to-end

2. **Performance benchmarks**
   - Damage calculation speed
   - Type effectiveness lookup performance

3. **Edge case testing**
   - Bertymon with 0 HP
   - Invalid stat stage combinations
   - Extreme damage scenarios

4. **Snapshot testing**
   - Battle messages
   - Damage numbers

## Troubleshooting

### Tests failing after code changes

1. Check Jest output for specific assertion failures
2. Verify game-logic functions haven't changed signatures
3. Run `npm test` to see full error messages
4. Use `npm run test:watch` to iterate quickly

### Coverage dropping

If coverage drops after changes:

1. Run `npm run test:coverage` to see which lines aren't covered
2. Add tests for new functions or branches
3. Verify no untested code paths were introduced

### Module import errors

If tests can't find game-logic.js:

1. Verify file exists at `bertymon/game-logic.js`
2. Check Jest config in `jest.config.js`
3. Ensure require paths are correct in test file

## References

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Test Coverage**: https://jestjs.io/docs/coverage
- **Game Logic**: See `bertymon/game-logic.js` for source code
- **Tests**: See `bertymon/game-logic.test.js` for all test cases
