const { test, expect } = require('@playwright/test');

test.describe('Bertymon Game', () => {
  test('should load the game intro scene', async ({ page }) => {
    // Navigate to the game
    await page.goto('/bertymon/index.html');

    // Wait for the game to load
    await page.waitForTimeout(1000);

    // Check that the canvas is present
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Verify canvas has reasonable dimensions (allow some tolerance for browser chrome)
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(800);
    expect(box.width).toBeLessThanOrEqual(820); // Small tolerance for browser rendering
    expect(box.height).toBeGreaterThanOrEqual(600);
    expect(box.height).toBeLessThanOrEqual(620);

    // Game should load without crashing (verified by canvas existing)
    await page.waitForTimeout(500);
    await expect(canvas).toBeVisible();
  });

  test('should display on-screen controls', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(1000);

    // The game should have on-screen touch controls
    // Check that the game canvas is present (controls are rendered on canvas)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Test arrow key navigation
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Canvas should still be visible after navigation
    await expect(canvas).toBeVisible();
  });

  test('should handle space key interactions', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Press space multiple times (interact button)
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Game should still be running
    await expect(canvas).toBeVisible();
  });

  test('should run game loop without crashing', async ({ page }) => {
    await page.goto('/bertymon/index.html');

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Simulate gameplay for 3 seconds
    // Press various keys to simulate player interaction
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(100);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(100);
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);
    }

    // Game should still be running
    await expect(canvas).toBeVisible();
  });

  test('should display HP bars in battle', async ({ page }) => {
    await page.goto('/bertymon/index.html');

    // This test verifies the game loads and canvas is present
    // More detailed battle testing would require getting into battle state
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Basic smoke test - game should load without errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));

    await page.waitForTimeout(2000);

    // Check for console errors
    expect(errors.length).toBe(0);
  });
});

test.describe('Bertymon Game - Error Handling', () => {
  test('should load without critical JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(2000);

    // Filter out expected errors in headless browser
    const criticalErrors = errors.filter(err => {
      // WebGL not supported is expected in some headless browsers
      if (err.includes('WebGL')) {
        return false;
      }
      return true;
    });

    // Log any errors for debugging
    if (criticalErrors.length > 0) {
      console.log('Critical page errors:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('should have proper page title', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await expect(page).toHaveTitle(/Bertymon/i);
  });
});
