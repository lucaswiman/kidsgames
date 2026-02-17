# Bertymon Game

A Pokemon-inspired RPG game featuring turn-based battles, creature collection, and an engaging gameplay experience.

## Running Tests

### Unit Tests (Jest)

Run unit tests for game logic:

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

**Status**: ✅ 43 tests passing with 100% coverage

See [TEST-QUICK-START.md](./TEST-QUICK-START.md) for detailed unit test information.

### E2E Tests (Playwright)

Run end-to-end tests in a real browser:

```bash
# Run all e2e tests
npm run test:e2e

# Run tests with UI (visual test runner)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

**Test Files**: `bertymon/bertymon.e2e.test.js`

**Comprehensive Test Coverage** (15 tests):

#### Game Load (3 tests)

- ✅ Load without JavaScript errors
- ✅ Have correct page title
- ✅ Render canvas at correct size (800x600)

#### Intro Scene (2 tests)

- ✅ Allow player to move with arrow keys
- ✅ Allow player to enter lab

#### Starter Selection (3 tests)

- ✅ Select Flarepup → rival gets Aquawing
- ✅ Select Aquawing → rival gets Treebeast
- ✅ Select Treebeast → rival gets Flarepup

#### Battle Actions (4 tests)

- ✅ Open and close move selection menu
- ✅ Execute move and change rival HP
- ✅ Use potion from bag (HP increase, quantity decrease)
- ✅ Open and close party menu

#### Battle Flow (2 tests)

- ✅ Progress through multiple turns
- ✅ Complete battle and return to intro (full battle cycle)

#### Error Resilience (1 test)

- ✅ Handle rapid key presses without crashing

**Status**: ✅ All tests use meaningful assertions (HP, scene state, party composition)

### Test Organization

- **Unit Tests** (Jest): `bertymon/game-logic.test.js` - Game logic functions
- **E2E Tests** (Playwright): `bertymon/bertymon.e2e.test.js` - Full game integration
- **Config**: `jest.config.js`, `playwright.config.js`

## Documentation

- [GAMEPLAY-SPEC.md](./GAMEPLAY-SPEC.md) - Game mechanics and features
- [BATTLE-SYSTEM-README.md](./BATTLE-SYSTEM-README.md) - Battle mechanics
- [BATTLE-TESTING-GUIDE.md](./BATTLE-TESTING-GUIDE.md) - Battle testing procedures
- [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) - Technical overview
- [TEST-QUICK-START.md](./TEST-QUICK-START.md) - Unit test details
