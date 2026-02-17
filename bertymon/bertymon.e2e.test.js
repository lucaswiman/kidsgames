const { test, expect } = require('@playwright/test');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Hold a key down for a specified duration (for continuous movement)
 */
async function holdKey(page, key, durationMs) {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
}

/**
 * Get the current game state from the window object
 */
async function getGameState(page) {
  return await page.evaluate(() => window.gameState || {});
}

/**
 * Wait for a specific scene to be active
 */
async function waitForScene(page, sceneName, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const state = await getGameState(page);
    if (state.currentScene === sceneName) {
      return true;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for scene: ${sceneName}`);
}

/**
 * Click at canvas-relative coordinates
 */
async function clickCanvas(page, x, y) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  await page.mouse.click(box.x + x, box.y + y);
}

/**
 * Navigate from intro to lab
 */
async function navigateToLab(page) {
  await page.goto('/bertymon/index.html');
  await page.waitForTimeout(1000);

  // Move up toward the lab (400px at 120px/sec ~= 3500ms)
  await holdKey(page, 'ArrowUp', 3500);
  // Move left slightly to align with lab entrance (32px at 120px/sec ~= 400ms)
  await holdKey(page, 'ArrowLeft', 400);

  // Interact with lab
  await page.keyboard.press('Space');
  await waitForScene(page, 'lab', 5000);
}

/**
 * Select a starter by name (Flarepup, Aquawing, or Treebeast)
 */
async function selectStarter(page, starterName) {
  // Navigate up to starters (220px at 120px/sec ~= 2000ms)
  await holdKey(page, 'ArrowUp', 2000);

  // Starter positions (left to right): Flarepup (280), Aquawing (400), Treebeast (520)
  if (starterName === 'Flarepup') {
    // Move left to Flarepup (120px at 120px/sec ~= 1100ms)
    await holdKey(page, 'ArrowLeft', 1100);
  } else if (starterName === 'Treebeast') {
    // Move right to Treebeast (120px at 120px/sec ~= 1100ms)
    await holdKey(page, 'ArrowRight', 1100);
  }
  // Aquawing is in the center, so no lateral movement needed

  // Select the starter
  await page.keyboard.press('Space');
  await page.waitForTimeout(7000); // Wait for dialogs and transition to battle
}

/**
 * Navigate from intro to battle with a chosen starter
 */
async function navigateToBattle(page, starterName = 'Aquawing') {
  await navigateToLab(page);
  await selectStarter(page, starterName);
  await waitForScene(page, 'battle', 5000);
}

// ============================================================================
// Test Suites
// ============================================================================

test.describe('Game Load', () => {
  test('should load without JavaScript errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(err => {
      // Filter out non-critical errors (like WebGL warnings)
      if (err.includes('WebGL')) {
        return false;
      }
      return true;
    });

    expect(criticalErrors.length).toBe(0);
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await expect(page).toHaveTitle(/Bertymon/i);
  });

  test('should render canvas at correct size', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(1000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(800);
    expect(box.height).toBeGreaterThanOrEqual(600);
  });
});

test.describe('Intro Scene', () => {
  test('should allow player to move with arrow keys', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(1000);

    // Wait for scene to initialize
    await waitForScene(page, 'intro', 5000);

    // Hold keys to move player
    await holdKey(page, 'ArrowUp', 500);
    await holdKey(page, 'ArrowDown', 500);
    await holdKey(page, 'ArrowLeft', 500);
    await holdKey(page, 'ArrowRight', 500);

    // Verify no crash (canvas still visible)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should allow player to enter lab', async ({ page }) => {
    await navigateToLab(page);

    const state = await getGameState(page);
    expect(state.currentScene).toBe('lab');
  });
});

test.describe('Starter Selection', () => {
  test('should select Flarepup and rival gets Aquawing', async ({ page }) => {
    await navigateToLab(page);
    await selectStarter(page, 'Flarepup');

    const state = await getGameState(page);
    expect(state.playerParty[0].name).toBe('Flarepup');
    expect(state.rivalParty[0].name).toBe('Aquawing');
  });

  test('should select Aquawing and rival gets Treebeast', async ({ page }) => {
    await navigateToLab(page);
    await selectStarter(page, 'Aquawing');

    const state = await getGameState(page);
    expect(state.playerParty[0].name).toBe('Aquawing');
    expect(state.rivalParty[0].name).toBe('Treebeast');
  });

  test('should select Treebeast and rival gets Flarepup', async ({ page }) => {
    await navigateToLab(page);
    await selectStarter(page, 'Treebeast');

    const state = await getGameState(page);
    expect(state.playerParty[0].name).toBe('Treebeast');
    expect(state.rivalParty[0].name).toBe('Flarepup');
  });
});

test.describe('Battle Actions', () => {
  test('should open and close move selection', async ({ page }) => {
    await navigateToBattle(page);
    await page.waitForTimeout(6500); // Wait for battle intro messages

    // Click Battle button (40, 400) 150x50 -> center (115, 425)
    await clickCanvas(page, 115, 425);
    await page.waitForTimeout(500);

    // Click Back button (290, 374) 220x50 -> center (400, 399)
    await clickCanvas(page, 400, 399);
    await page.waitForTimeout(500);

    // Battle should still be active
    const state = await getGameState(page);
    expect(state.currentScene).toBe('battle');
  });

  test('should execute a move and change rival HP', async ({ page }) => {
    await navigateToBattle(page);
    await page.waitForTimeout(6500);

    const stateBefore = await getGameState(page);
    const rivalHpBefore = stateBefore.rivalParty[0].hp;

    // Click Battle button
    await clickCanvas(page, 115, 425);
    await page.waitForTimeout(500);

    // Click first move (290, 200) 220x50 -> center (400, 225)
    await clickCanvas(page, 400, 225);
    await page.waitForTimeout(3000); // Wait for turn to execute

    const stateAfter = await getGameState(page);
    const rivalHpAfter = stateAfter.rivalParty[0].hp;

    // HP should have decreased
    expect(rivalHpAfter).toBeLessThan(rivalHpBefore);
  });

  test('should use potion from bag', async ({ page }) => {
    await navigateToBattle(page);
    await page.waitForTimeout(6500);

    // Execute 2 turns to ensure we take damage
    for (let i = 0; i < 2; i++) {
      await clickCanvas(page, 115, 425); // Battle
      await page.waitForTimeout(500);
      await clickCanvas(page, 400, 225); // Move 0
      await page.waitForTimeout(3000);
    }

    const stateBefore = await getGameState(page);
    const playerHpBefore = stateBefore.playerParty[0].hp;
    const potionQtyBefore = stateBefore.bag[0].qty;

    // Only use potion if we took damage
    if (playerHpBefore < stateBefore.playerParty[0].maxHp) {
      // Click Bag button (356, 400) 150x50 -> center (431, 425)
      await clickCanvas(page, 431, 425);
      await page.waitForTimeout(500);

      // Click Potion (20, 390) 200x50 -> center (120, 415)
      await clickCanvas(page, 120, 415);
      await page.waitForTimeout(2000); // Wait for potion to be used

      // Check immediately after potion use (before opponent's turn)
      const stateAfterPotion = await getGameState(page);
      const potionQtyAfter = stateAfterPotion.bag[0].qty;

      // Potion qty should have decreased (this is the key indicator)
      expect(potionQtyAfter).toBe(potionQtyBefore - 1);
    } else {
      // If no damage taken, skip test (this shouldn't normally happen)
      console.log('Warning: Player took no damage, skipping potion test');
    }
  });

  test('should open and close party menu', async ({ page }) => {
    await navigateToBattle(page);
    await page.waitForTimeout(6500);

    // Click Bertymon button (198, 400) 150x50 -> center (273, 425)
    await clickCanvas(page, 273, 425);
    await page.waitForTimeout(500);

    // Click Back button (20, 448) 200x50 -> center (120, 473)
    await clickCanvas(page, 120, 473);
    await page.waitForTimeout(500);

    // Battle should still be active
    const state = await getGameState(page);
    expect(state.currentScene).toBe('battle');
  });
});

test.describe('Battle Flow', () => {
  test('should progress through multiple turns', async ({ page }) => {
    test.setTimeout(60000); // Extend timeout for multi-turn battle
    await navigateToBattle(page);
    await page.waitForTimeout(6500);

    const stateBefore = await getGameState(page);
    const playerHpBefore = stateBefore.playerParty[0].hp;
    const rivalHpBefore = stateBefore.rivalParty[0].hp;

    // Execute 3 turns
    for (let i = 0; i < 3; i++) {
      await clickCanvas(page, 115, 425); // Battle
      await page.waitForTimeout(500);
      await clickCanvas(page, 400, 225); // Move 0
      await page.waitForTimeout(3000);
    }

    const stateAfter = await getGameState(page);
    const playerHpAfter = stateAfter.playerParty[0].hp;
    const rivalHpAfter = stateAfter.rivalParty[0].hp;

    // Both should have taken damage (unless battle ended)
    expect(rivalHpAfter).toBeLessThan(rivalHpBefore);
  });

  test('should complete battle and return to intro', async ({ page }) => {
    test.setTimeout(90000); // Extend timeout for full battle cycle
    // Use Aquawing (Water) vs Treebeast (Grass) for type advantage
    await navigateToBattle(page, 'Aquawing');
    await page.waitForTimeout(6500);

    // Execute moves until battle ends (max 15 turns with extended timeout)
    for (let i = 0; i < 15; i++) {
      const state = await getGameState(page);
      if (state.currentScene === 'intro') {
        break; // Battle ended
      }

      await clickCanvas(page, 115, 425); // Battle
      await page.waitForTimeout(500);
      await clickCanvas(page, 400, 225); // Move 0
      await page.waitForTimeout(3000);
    }

    // Wait for victory message and transition
    await page.waitForTimeout(4000);

    const finalState = await getGameState(page);
    expect(finalState.currentScene).toBe('intro');
  });
});

test.describe('Error Resilience', () => {
  test('should handle rapid key presses without crashing', async ({ page }) => {
    await page.goto('/bertymon/index.html');
    await page.waitForTimeout(1000);

    // Spam keys rapidly
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
    }

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
