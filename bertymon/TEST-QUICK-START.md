# Bertymon Tests - Quick Start

## One-Minute Setup

```bash
# From the project root
cd /Users/lucaswiman/personal/kidsgames

# Install dependencies (one time)
npm install

# Run tests
npm test
```

## Common Commands

```bash
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Show code coverage
npm run test:coverage

# Run specific test file
npm test game-logic.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="createBertymon"
```

## Current Status

✅ **43 tests passing**
✅ **100% code coverage** (statements and functions)
✅ **95.23% branch coverage**

## Test Results Summary

```
PASS bertymon/game-logic.test.js

Test Suites: 1 passed, 1 total
Tests:       43 passed, 43 total
Time:        0.173s
```

## What's Tested

| Function | Tests | Coverage |
|----------|-------|----------|
| `createBertymon()` | 5 | ✅ 100% |
| `getTypeEffectiveness()` | 4 | ✅ 100% |
| `getStatWithStages()` | 6 | ✅ 100% |
| `calculateDamage()` | 6 | ✅ 100% |
| `getRivalStarter()` | 5 | ✅ 100% |
| `applyMoveEffect()` | 5 | ✅ 100% |
| Data structures | 9 | ✅ 100% |
| Integration | 3 | ✅ 100% |

## Test Categories

### Data Structure Tests (9 tests)
- MOVES constant
- BERTYMON_TEMPLATES constant

### Unit Tests (26 tests)
- Individual function behavior
- Edge cases and error handling

### Integration Tests (3 tests)
- Full battle scenarios
- Multiple systems working together

### Coverage Breakdown

```
File             % Stmts  % Branches  % Funcs  % Lines
game-logic.js      100        95.23     100      100
```

## Key Metrics

- **Total Tests**: 43
- **Passing**: 43 (100%)
- **Failing**: 0
- **Skipped**: 0
- **Duration**: ~0.17 seconds

## Files

- **Test Source**: `bertymon/game-logic.test.js` (270+ lines)
- **Code Source**: `bertymon/game-logic.js` (130+ lines)
- **Config**: `jest.config.js`
- **Setup**: `package.json`

## Example Test Output

```
PASS bertymon/game-logic.test.js
  MOVES Data Structure
    ✓ should have 6 moves defined
    ✓ should have Leafage move
    ✓ should have status move Leer
    ✓ all moves should have name and type
  BERTYMON_TEMPLATES Data Structure
    ✓ should have 3 starter templates
    ✓ should have Treebeast template
    ✓ should have Flarepup template
    ✓ should have Aquawing template
    ✓ all templates should have required properties
  createBertymon()
    ✓ should create Treebeast with correct stats
    ✓ should have initial stat stages at 0
    ✓ should have moves array
    ✓ should create independent instances
    ✓ should throw error for unknown template
  ... and 28 more tests
```

## Coverage Report Example

```
% Stmts  % Branches  % Funcs  % Lines
100        95.23      100       100

File             | % Stmts | % Branch | % Funcs | % Lines
game-logic.js    |   100   |  95.23   |  100    |   100
```

## Next Steps

1. **Run tests**: `npm test`
2. **Check coverage**: `npm run test:coverage`
3. **Watch mode**: `npm run test:watch`
4. **Read full docs**: See `TESTING.md`

## Troubleshooting

**Tests won't run?**
- Make sure you're in the project root
- Run `npm install` first
- Check that Node.js is installed (`node --version`)

**Coverage not showing?**
- Run `npm run test:coverage` instead of `npm test`
- Check for HTML report: `open coverage/lcov-report/index.html`

**Want to add more tests?**
- Edit `bertymon/game-logic.test.js`
- Run `npm run test:watch` to see results immediately
- Keep tests focused on pure functions

## Notes

- All pure game logic is testable (no Kaplay/DOM dependencies)
- Battle UI remains untested (requires Kaplay mock)
- Tests run in Node.js environment (not browser)
- No external test data files needed - tests are self-contained
