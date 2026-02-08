# Bertymon E2E Tests

## Overview

End-to-end tests for the Bertymon game using Playwright. These tests verify the game works correctly in a real browser environment.

## Running Tests

### Install Dependencies

```bash
npm install
npx playwright install chromium
```

### Run Tests

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run tests with UI (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed
```

## Test Coverage

### Basic Tests

1. **Game Loading** - Verifies the game loads without errors
2. **Intro Scene** - Checks intro scene displays correctly
3. **Lab Entry** - Tests entering the professor's lab
4. **Starter Selection** - Verifies starter selection works
5. **Battle Start** - Tests battle scene initialization
6. **Battle UI** - Verifies battle menu and move selection

### Error Handling Tests

1. **No JavaScript Errors** - Ensures game runs without console errors
2. **Page Title** - Verifies correct page title

## Test Structure

```
tests/
├── bertymon.test.js    - Main E2E test suite
└── README.md           - This file
```

## Writing New Tests

Add new test cases to `bertymon.test.js`:

```javascript
test('should do something', async ({ page }) => {
  await page.goto('/bertymon/index.html');
  // Your test code here
});
```

## Tips

- Use `await page.waitForTimeout(ms)` to wait for game state changes
- The game runs on a canvas, so most interactions are keyboard-based
- Use `page.keyboard.press()` for game controls
- Check for text with `page.locator('text=...')`

## Debugging

### View Test Report

After running tests:

```bash
npx playwright show-report
```

### Take Screenshots

Playwright automatically takes screenshots on failure. Find them in `test-results/`.

### Run Specific Test

```bash
npx playwright test --grep "should load the game"
```

### Debug Mode

```bash
npx playwright test --debug
```

## Known Limitations

- Game state is canvas-based, so visual verification is limited
- Some interactions require precise timing due to game loops
- Tests use keyboard controls primarily (touch controls harder to test)

## Configuration

See `playwright.config.js` for configuration:

- Timeout: 30 seconds per test
- Retries: 2 retries in CI
- Web server: Automatically starts Python HTTP server on port 8000

## CI Integration

Tests are configured for CI with:

- Automatic retries on failure
- Screenshot/trace on first retry
- HTML report generation
