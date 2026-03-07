/**
 * Bertymon - A Pokemon-inspired adventure game for Berty!
 */

import {
  MOVES,
  BERTYMON_TEMPLATES,
  BERTYBUCKS_BATTLE_REWARD,
  createBertymon,
  getTypeEffectiveness,
  getStatWithStages,
  calculateDamage,
  getRivalStarter,
  applyMoveEffect,
  updateBertyBucks,
  attemptCapture,
} from './game-logic.js';

// Initialize KAPLAY
kaplay({
  width: 800,
  height: 600,
  background: [135, 206, 235], // Sky blue
  crisp: true,
});

// Simple input helper that uses arrow keys on desktop
// and on-screen touch controls on touch devices (e.g. iPad)
function setupMovementControls(player, speed) {
  // Keyboard controls (always enabled, harmless on touch-only devices)
  onKeyDown('left', () => {
    player.move(-speed, 0);
  });

  onKeyDown('right', () => {
    player.move(speed, 0);
  });

  onKeyDown('up', () => {
    player.move(0, -speed);
  });

  onKeyDown('down', () => {
    player.move(0, speed);
  });

  // On-screen arrows will move the player one step per click/tap

  // Always show on-screen controls for testing

  // On-screen D‑pad for touch devices
  const btnSize = 64;
  const margin = 16;
  const baseX = margin + btnSize;
  const baseY = height() - margin - btnSize;

  function makeButton(label, offsetX, offsetY, dir) {
    const btn = add([
      rect(btnSize, btnSize),
      pos(baseX + offsetX, baseY + offsetY),
      anchor('center'),
      color(0, 0, 0),
      opacity(0.35),
      outline(2, rgb(255, 255, 255)),
      area(),
      'touch-btn',
      { dir },
    ]);

    add([
      text(label, { size: 18, font: 'monospace' }),
      pos(baseX + offsetX, baseY + offsetY),
      anchor('center'),
      color(255, 255, 255),
      'touch-btn-label',
    ]);

    // Move once per click / tap, equivalent to four key presses
    btn.onClick(() => {
      if (dir.x) {
        player.move(dir.x * speed * 8, 0);
      }
      if (dir.y) {
        player.move(0, dir.y * speed * 8);
      }
    });
  }

  // Center “Select” button
  function makeSelectButton(label, offsetX, offsetY) {
    const btn = add([
      rect(btnSize, btnSize),
      pos(baseX + offsetX, baseY + offsetY),
      anchor('center'),
      color(0, 0, 0),
      opacity(0.35),
      outline(2, rgb(255, 255, 255)),
      area(),
      'touch-btn-select',
    ]);

    add([
      text(label, { size: 14, font: 'monospace' }),
      pos(baseX + offsetX, baseY + offsetY),
      anchor('center'),
      color(255, 255, 255),
      'touch-btn-label',
    ]);

    // Trigger global select handler if defined
    btn.onClick(() => {
      if (window.handleSelect) {
        window.handleSelect();
      }
    });
  }

  // Up
  makeButton('▲', 0, -btnSize, { x: 0, y: -1 });
  // Down
  makeButton('▼', 0, btnSize, { x: 0, y: 1 });
  // Left
  makeButton('◀', -btnSize, 0, { x: -1, y: 0 });
  // Right
  makeButton('▶', btnSize, 0, { x: 1, y: 0 });
  // Select (center)
  makeSelectButton('SEL', 0, 0);
}

// Load sprites
loadSprite(
  'player',
  'data:image/svg+xml;base64,' +
    btoa(`
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="#ff6b6b"/>
        <rect x="8" y="8" width="16" height="16" fill="#4ecdc4"/>
        <circle cx="16" cy="12" r="2" fill="white"/>
    </svg>
`)
);

// Load Bertymon sprites
loadSprite('aquawing', 'sprites/Aquawing.png');
loadSprite('flarepup', 'sprites/Flarepup.png');
loadSprite('treebeast', 'sprites/Treebeast.png');

loadSprite(
  'professor',
  'data:image/svg+xml;base64,' +
    btoa(`
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="#95a5a6"/>
        <rect x="6" y="6" width="20" height="20" fill="#f39c12"/>
        <circle cx="16" cy="14" r="3" fill="white"/>
        <rect x="12" y="20" width="8" height="4" fill="#e74c3c"/>
    </svg>
`)
);

loadSprite(
  'lab',
  'data:image/svg+xml;base64,' +
    btoa(`
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="#8e44ad"/>
        <rect x="8" y="8" width="48" height="48" fill="#9b59b6"/>
        <rect x="24" y="32" width="16" height="24" fill="#34495e"/>
        <rect x="16" y="16" width="12" height="12" fill="#f1c40f"/>
        <rect x="36" y="16" width="12" height="12" fill="#f1c40f"/>
    </svg>
`)
);

loadSprite(
  'grass',
  'data:image/svg+xml;base64,' +
    btoa(`
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="#e8e8e8"/>
        <rect x="4" y="4" width="24" height="24" fill="#ffffff"/>
    </svg>
`)
);

// Step 2: Expand Game State
const gameState = {
  playerName: 'Berty',
  hasStarterBertymon: false,
  currentScene: 'intro',
  playerParty: [],
  rivalParty: [],
  bag: [{ name: 'Potion', qty: 3, hpRestore: 20 }],
  activeBertymonIndex: 0,
  bertyBucks: 0,
};

// Intro scene
scene('intro', () => {
  gameState.currentScene = 'intro';
  // Create grass background
  for (let x = 0; x < width() / 32; x++) {
    for (let y = 0; y < height() / 32; y++) {
      add([sprite('grass'), pos(x * 32, y * 32), 'grass']);
    }
  }

  // Add professor's lab
  const lab = add([sprite('lab'), pos(width() / 2 - 32, 100), area(), 'lab', 'interactable']);

  // Add professor near the lab (only before the player has chosen a starter)
  if (!gameState.hasStarterBertymon) {
    add([sprite('professor'), pos(width() / 2, 180), area(), 'professor', 'interactable']);
  }

  // Add player
  const player = add([
    sprite('player'),
    pos(width() / 2, height() - 100),
    area(),
    body(),
    'player',
  ]);

  // Add follower Bertymon if the player has one
  let follower = null;
  const posHistory = [];
  const FOLLOW_DELAY = 12; // frames of delay before follower reaches player's old position

  if (gameState.playerParty.length > 0) {
    const activeBertymon = gameState.playerParty[gameState.activeBertymonIndex];
    follower = add([
      sprite(activeBertymon.sprite),
      pos(player.pos.x, player.pos.y + 36),
      anchor('center'),
      scale(0.8),
      'follower',
    ]);
  }

  // Player movement (keyboard + touch)
  const SPEED = 120;
  setupMovementControls(player, SPEED);

  // Keep player in bounds and update follower
  player.onUpdate(() => {
    if (player.pos.x < 0) {
      player.pos.x = 0;
    }
    if (player.pos.x > width() - 32) {
      player.pos.x = width() - 32;
    }
    if (player.pos.y < 0) {
      player.pos.y = 0;
    }
    if (player.pos.y > height() - 32) {
      player.pos.y = height() - 32;
    }

    // Record player position history for follower
    if (follower) {
      posHistory.push({ x: player.pos.x + 16, y: player.pos.y + 16 });
      if (posHistory.length > FOLLOW_DELAY) {
        const target = posHistory.shift();
        follower.pos.x = target.x;
        follower.pos.y = target.y;
      }
    }
  });

  // Interaction system
  const handleSelect = () => {
    // Check if player is near any interactable object
    const interactables = get('interactable');

    interactables.forEach(obj => {
      const distance = player.pos.dist(obj.pos);
      if (distance < 60) {
        if (obj.is('professor')) {
          showProfessorDialog();
        } else if (obj.is('lab')) {
          enterLab();
        }
      }
    });
  };
  window.handleSelect = handleSelect;
  onKeyPress('space', handleSelect);

  // UI Text (welcome message only shown before choosing a starter)
  if (!gameState.hasStarterBertymon) {
    add([
      text('Welcome to the world of Bertymon!', {
        size: 24,
        font: 'monospace',
      }),
      pos(width() / 2, 30),
      anchor('center'),
      color(0, 200, 0),
      outline(2, rgb(0, 0, 0)),
    ]);
  }

  add([
    text(`BB: ${gameState.bertyBucks}`, {
      size: 20,
      font: 'monospace',
    }),
    pos(10, 10),
    anchor('topleft'),
    color(255, 215, 0),
    outline(2, rgb(0, 0, 0)),
  ]);

  add([
    text('Use arrow keys or on-screen arrows to move, SPACE to interact', {
      size: 16,
      font: 'monospace',
    }),
    pos(width() / 2, height() - 30),
    anchor('center'),
    color(255, 255, 255),
    outline(1, rgb(0, 0, 0)),
  ]);

  // Dialog functions
  function showProfessorDialog() {
    add([
      rect(width() - 40, 120),
      pos(20, height() - 140),
      color(255, 255, 255),
      outline(2, rgb(0, 0, 0)),
      'dialog',
    ]);

    add([
      text(
        'Professor Willow: Hello there, ' +
          gameState.playerName +
          '!\nWelcome to the world of Bertymon!\nHead to my lab to choose your first companion!',
        {
          size: 14,
          font: 'monospace',
          width: width() - 80,
        }
      ),
      pos(40, height() - 120),
      color(0, 0, 0),
      'dialog',
    ]);

    // Auto-close dialog after 4 seconds
    wait(4, () => {
      destroyAll('dialog');
    });
  }

  function enterLab() {
    go('lab');
  }
});

// Lab scene
scene('lab', () => {
  gameState.currentScene = 'lab';

  // If the player already has a Bertymon, show a peaceful revisit scene
  if (gameState.hasStarterBertymon && gameState.playerParty.length > 0) {
    add([
      rect(width(), height()),
      pos(0, 0),
      color(139, 69, 19), // Brown floor
    ]);

    // Lab equipment
    add([rect(100, 60), pos(50, 100), color(192, 192, 192), 'equipment']);
    add([rect(100, 60), pos(width() - 150, 100), color(192, 192, 192), 'equipment']);

    // Show unchosen starters hanging out
    const allStarters = [
      { name: 'Flarepup', sprite: 'flarepup', type: 'Fire' },
      { name: 'Aquawing', sprite: 'aquawing', type: 'Water' },
      { name: 'Treebeast', sprite: 'treebeast', type: 'Grass' },
    ];
    const chosenName = gameState.playerParty[0].name;
    const unchosen = allStarters.filter(s => s.name !== chosenName);

    unchosen.forEach((starter, i) => {
      add([
        sprite(starter.sprite),
        pos(width() / 2 - 60 + i * 120, height() / 2),
        anchor('center'),
        scale(1.0),
      ]);

      add([
        text(starter.name, {
          size: 12,
          font: 'monospace',
        }),
        pos(width() / 2 - 60 + i * 120, height() / 2 + 50),
        anchor('center'),
        color(255, 255, 255),
        outline(1, rgb(0, 0, 0)),
      ]);
    });

    // Header
    add([
      text("Professor's Lab", {
        size: 20,
        font: 'monospace',
      }),
      pos(width() / 2, 30),
      anchor('center'),
      color(255, 255, 255),
      outline(2, rgb(0, 0, 0)),
    ]);

    // Professor Willow note
    add([
      text('Professor Willow is over at the fountain.', {
        size: 16,
        font: 'monospace',
      }),
      pos(width() / 2, height() / 2 + 100),
      anchor('center'),
      color(255, 255, 200),
      outline(1, rgb(0, 0, 0)),
    ]);

    // Exit hint
    add([
      text('Press SPACE to leave', {
        size: 14,
        font: 'monospace',
      }),
      pos(width() / 2, height() - 30),
      anchor('center'),
      color(255, 255, 255),
      outline(1, rgb(0, 0, 0)),
    ]);

    onKeyPress('space', () => {
      go('intro');
    });
    window.handleSelect = () => {
      go('intro');
    };

    return;
  }

  add([
    rect(width(), height()),
    pos(0, 0),
    color(139, 69, 19), // Brown floor
  ]);

  // Lab equipment (simple rectangles for now)
  add([rect(100, 60), pos(50, 100), color(192, 192, 192), 'equipment']);

  add([rect(100, 60), pos(width() - 150, 100), color(192, 192, 192), 'equipment']);

  // Three starter Bertymon
  const starters = [
    { name: 'Flarepup', sprite: 'flarepup', type: 'Fire' },
    { name: 'Aquawing', sprite: 'aquawing', type: 'Water' },
    { name: 'Treebeast', sprite: 'treebeast', type: 'Grass' },
  ];

  starters.forEach((starter, i) => {
    add([
      sprite(starter.sprite),
      pos(width() / 2 - 120 + i * 120, height() / 2),
      anchor('center'), // Center the sprite
      scale(1.0), // Make sprites 200% bigger
      area(),
      'starter',
      { starterData: starter },
    ]);

    add([
      text(starter.name, {
        size: 12,
        font: 'monospace',
      }),
      pos(width() / 2 - 120 + i * 120, height() / 2 + 50),
      anchor('center'),
      color(255, 255, 255),
      outline(1, rgb(0, 0, 0)),
    ]);
  });

  // Add player in lab
  const player = add([sprite('player'), pos(width() / 2, height() - 80), area(), body(), 'player']);

  // Player movement (keyboard + touch)
  const SPEED = 120;
  setupMovementControls(player, SPEED);

  // Keep player in bounds
  player.onUpdate(() => {
    if (player.pos.x < 16) {
      player.pos.x = 16;
    }
    if (player.pos.x > width() - 48) {
      player.pos.x = width() - 48;
    }
    if (player.pos.y < 16) {
      player.pos.y = 16;
    }
    if (player.pos.y > height() - 48) {
      player.pos.y = height() - 48;
    }
  });

  // Starter selection
  const handleSelect = () => {
    const starters = get('starter');

    starters.forEach(starter => {
      const distance = player.pos.dist(starter.pos);
      if (distance < 50) {
        selectStarter(starter.starterData);
      }
    });
  };
  window.handleSelect = handleSelect;
  onKeyPress('space', handleSelect);

  function selectStarter(starterData) {
    if (gameState.hasStarterBertymon) {
      return;
    } // guard against double-selection
    gameState.hasStarterBertymon = true;
    gameState.starterBertymon = starterData;
    gameState.playerParty = [];
    gameState.rivalParty = [];
    gameState.activeBertymonIndex = 0;

    // Step 3: Create Bertymon instances
    const playerBertymon = createBertymon(starterData.name);
    gameState.playerParty.push(playerBertymon);

    const rivalStarterName = getRivalStarter(starterData.name);
    const rivalBertymon = createBertymon(rivalStarterName);
    gameState.rivalParty.push(rivalBertymon);

    // Show selection dialog
    add([
      rect(width() - 40, 100),
      pos(20, 20),
      color(255, 255, 255),
      outline(2, rgb(0, 0, 0)),
      'dialog',
    ]);

    add([
      text(`Congratulations! You chose ${starterData.name}!\nYour adventure begins now!`, {
        size: 16,
        font: 'monospace',
        width: width() - 80,
      }),
      pos(40, 40),
      color(0, 0, 0),
      'dialog',
    ]);

    wait(3, () => {
      destroyAll('dialog');
      // Show rival challenge dialog
      add([
        rect(width() - 40, 100),
        pos(20, 20),
        color(255, 255, 255),
        outline(2, rgb(0, 0, 0)),
        'dialog',
      ]);

      add([
        text(`Rival: I'll take ${rivalStarterName}! Let's battle!`, {
          size: 16,
          font: 'monospace',
          width: width() - 80,
        }),
        pos(40, 40),
        color(0, 0, 0),
        'dialog',
      ]);

      wait(3, () => {
        destroyAll('dialog');
        go('battle');
      });
    });
  }

  // UI
  add([
    text("Professor's Lab - Choose Your Starter Bertymon!", {
      size: 20,
      font: 'monospace',
    }),
    pos(width() / 2, 30),
    anchor('center'),
    color(255, 255, 255),
    outline(2, rgb(0, 0, 0)),
  ]);

  add([
    text('Walk up to a Bertymon and press SPACE to choose', {
      size: 14,
      font: 'monospace',
    }),
    pos(width() / 2, height() - 30),
    anchor('center'),
    color(255, 255, 255),
    outline(1, rgb(0, 0, 0)),
  ]);
});

// ============================================================================
// Step 4-9: Battle Scene
// ============================================================================

scene('battle', () => {
  gameState.currentScene = 'battle';
  // Layout constants
  const ENEMY_NAME_POS = [480, 30];
  const ENEMY_HP_POS = [480, 55];
  const ENEMY_SPRITE_POS = [620, 130];
  const PLAYER_NAME_POS = [40, 195];
  const PLAYER_HP_POS = [40, 220];
  const PLAYER_SPRITE_POS = [180, 300];
  const HP_BAR_WIDTH = 160;

  const MSG_BOX_POS = [20, 500];
  const MSG_BOX_SIZE = [760, 80];
  const MSG_TEXT_POS = [40, 520];

  const ACTION_BTN_Y = 400;
  const MENU_BTN_START_Y = 390;
  const BTN_WIDTH = 150;
  const BTN_HEIGHT = 50;
  const BTN_GAP = 8;

  // Battle scene state
  const battleState = {
    phase: 'intro', // intro, action, move, bag, party, executing
    selectedMove: null,
    messageTimeout: null,
    isWild: false,
    wildBertymon: null,
  };

  // Step 4: Create battle scene layout
  // Background
  add([rect(width(), height()), pos(0, 0), color(220, 220, 220)]);

  // Message box background (persistent)
  add([
    rect(MSG_BOX_SIZE[0], MSG_BOX_SIZE[1]),
    pos(MSG_BOX_POS[0], MSG_BOX_POS[1]),
    color(255, 255, 255),
    outline(2, rgb(0, 0, 0)),
  ]);

  // ========================================================================
  // Helper Functions
  // ========================================================================

  function showBattleMessage(msg) {
    destroyAll('battle-msg');
    add([
      text(msg, {
        size: 14,
        font: 'monospace',
        width: MSG_BOX_SIZE[0] - 40,
      }),
      pos(MSG_TEXT_POS[0], MSG_TEXT_POS[1]),
      color(0, 0, 0),
      'battle-msg',
    ]);
  }

  function refreshHpBar(side) {
    if (side === 'player') {
      const bmon = gameState.playerParty[gameState.activeBertymonIndex];
      const hpPercent = bmon.hp / bmon.maxHp;
      destroyAll('player-hp');

      let hpColor = rgb(50, 200, 50); // Green
      if (hpPercent < 0.5) {
        hpColor = rgb(255, 200, 0);
      } // Yellow
      if (hpPercent < 0.2) {
        hpColor = rgb(255, 50, 50);
      } // Red

      add([
        rect(HP_BAR_WIDTH, 12),
        pos(PLAYER_HP_POS[0], PLAYER_HP_POS[1]),
        color(100, 100, 100),
        'player-hp',
      ]);
      add([
        rect(HP_BAR_WIDTH * hpPercent, 12),
        pos(PLAYER_HP_POS[0], PLAYER_HP_POS[1]),
        color(hpColor),
        'player-hp',
      ]);
      add([
        text(`HP: ${bmon.hp}/${bmon.maxHp}`, { size: 10, font: 'monospace' }),
        pos(PLAYER_HP_POS[0] + HP_BAR_WIDTH + 10, PLAYER_HP_POS[1] - 5),
        color(0, 0, 0),
        'player-hp',
      ]);
    } else {
      const bmon = gameState.rivalParty[0];
      const hpPercent = bmon.hp / bmon.maxHp;
      destroyAll('enemy-hp');

      let hpColor = rgb(50, 200, 50); // Green
      if (hpPercent < 0.5) {
        hpColor = rgb(255, 200, 0);
      } // Yellow
      if (hpPercent < 0.2) {
        hpColor = rgb(255, 50, 50);
      } // Red

      add([
        rect(HP_BAR_WIDTH, 12),
        pos(ENEMY_HP_POS[0], ENEMY_HP_POS[1]),
        color(100, 100, 100),
        'enemy-hp',
      ]);
      add([
        rect(HP_BAR_WIDTH * hpPercent, 12),
        pos(ENEMY_HP_POS[0], ENEMY_HP_POS[1]),
        color(hpColor),
        'enemy-hp',
      ]);
      add([
        text(`HP: ${bmon.hp}/${bmon.maxHp}`, { size: 10, font: 'monospace' }),
        pos(ENEMY_HP_POS[0] + HP_BAR_WIDTH + 10, ENEMY_HP_POS[1] - 5),
        color(0, 0, 0),
        'enemy-hp',
      ]);
    }
  }

  function refreshBattleDisplay() {
    // Update player display
    destroyAll('player-display');
    const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
    add([
      sprite(playerBmon.sprite),
      pos(PLAYER_SPRITE_POS[0], PLAYER_SPRITE_POS[1]),
      anchor('center'),
      scale(1.5),
      'player-display',
    ]);
    add([
      text(`${playerBmon.name} (${playerBmon.type})`, { size: 12, font: 'monospace' }),
      pos(PLAYER_NAME_POS[0], PLAYER_NAME_POS[1]),
      color(0, 0, 0),
      'player-display',
    ]);

    // Update enemy display
    destroyAll('enemy-display');
    const rivalBmon = gameState.rivalParty[0];
    add([
      sprite(rivalBmon.sprite),
      pos(ENEMY_SPRITE_POS[0], ENEMY_SPRITE_POS[1]),
      anchor('center'),
      scale(1.5),
      'enemy-display',
    ]);
    add([
      text(`${rivalBmon.name} (${rivalBmon.type})`, { size: 12, font: 'monospace' }),
      pos(ENEMY_NAME_POS[0], ENEMY_NAME_POS[1]),
      color(0, 0, 0),
      'enemy-display',
    ]);

    // Refresh HP bars
    refreshHpBar('player');
    refreshHpBar('enemy');
  }

  function hideActionButtons() {
    destroyAll('action-btn');
  }

  function showActionButtons() {
    hideActionButtons();
    const startX = 40;

    // Battle button
    const battleBtn = add([
      rect(BTN_WIDTH, BTN_HEIGHT),
      pos(startX, ACTION_BTN_Y),
      color(0, 0, 0),
      opacity(0.35),
      outline(2, rgb(255, 255, 255)),
      area(),
      'action-btn',
      { name: 'battle' },
    ]);
    add([
      text('Battle', { size: 14, font: 'monospace' }),
      pos(startX + BTN_WIDTH / 2, ACTION_BTN_Y + BTN_HEIGHT / 2),
      anchor('center'),
      color(255, 255, 255),
      'action-btn',
    ]);
    battleBtn.onClick(() => {
      hideActionButtons();
      showMoveButtons();
    });

    // Bertymon button
    const partyBtn = add([
      rect(BTN_WIDTH, BTN_HEIGHT),
      pos(startX + BTN_WIDTH + BTN_GAP, ACTION_BTN_Y),
      color(0, 0, 0),
      opacity(0.35),
      outline(2, rgb(255, 255, 255)),
      area(),
      'action-btn',
      { name: 'party' },
    ]);
    add([
      text('Bertymon', { size: 14, font: 'monospace' }),
      pos(startX + BTN_WIDTH + BTN_GAP + BTN_WIDTH / 2, ACTION_BTN_Y + BTN_HEIGHT / 2),
      anchor('center'),
      color(255, 255, 255),
      'action-btn',
    ]);
    partyBtn.onClick(() => {
      hideActionButtons();
      showPartyMenu();
    });

    // Bag button
    const bagBtn = add([
      rect(BTN_WIDTH, BTN_HEIGHT),
      pos(startX + (BTN_WIDTH + BTN_GAP) * 2, ACTION_BTN_Y),
      color(0, 0, 0),
      opacity(0.35),
      outline(2, rgb(255, 255, 255)),
      area(),
      'action-btn',
      { name: 'bag' },
    ]);
    add([
      text('Bag', { size: 14, font: 'monospace' }),
      pos(startX + (BTN_WIDTH + BTN_GAP) * 2 + BTN_WIDTH / 2, ACTION_BTN_Y + BTN_HEIGHT / 2),
      anchor('center'),
      color(255, 255, 255),
      'action-btn',
    ]);
    bagBtn.onClick(() => {
      hideActionButtons();
      showBagMenu();
    });
  }

  // Step 5: Move Selection UI
  function showMoveButtons() {
    const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
    const btnWidth = 220;
    const startX = 290;
    const startY = 200;

    // Show "SELECT A MOVE" header
    add([
      text('SELECT A MOVE:', { size: 16, font: 'monospace' }),
      pos(startX + btnWidth / 2, startY - 30),
      anchor('center'),
      color(0, 0, 0),
      'move-btn',
    ]);

    playerBmon.moves.forEach((moveName, i) => {
      const move = MOVES[moveName];
      const btnY = startY + i * (BTN_HEIGHT + BTN_GAP);

      const moveBtn = add([
        rect(btnWidth, BTN_HEIGHT),
        pos(startX, btnY),
        color(100, 150, 200),
        outline(3, rgb(0, 0, 0)),
        area(),
        'move-btn',
        { moveName },
      ]);

      add([
        text(`${move.name} (${move.type})`, { size: 14, font: 'monospace' }),
        pos(startX + btnWidth / 2, btnY + BTN_HEIGHT / 2),
        anchor('center'),
        color(255, 255, 255),
        'move-btn',
      ]);

      moveBtn.onClick(() => {
        battleState.selectedMove = move;
        destroyAll('move-btn');
        executeTurn(move);
      });

      // Add hover effect
      moveBtn.onHover(() => {
        moveBtn.color = rgb(120, 170, 220);
      });
      moveBtn.onHoverEnd(() => {
        moveBtn.color = rgb(100, 150, 200);
      });
    });

    // Back button
    const backBtn = add([
      rect(btnWidth, BTN_HEIGHT),
      pos(startX, startY + playerBmon.moves.length * (BTN_HEIGHT + BTN_GAP)),
      color(200, 100, 100),
      outline(3, rgb(0, 0, 0)),
      area(),
      'move-btn',
    ]);
    add([
      text('Back', { size: 14, font: 'monospace' }),
      pos(
        startX + btnWidth / 2,
        startY + playerBmon.moves.length * (BTN_HEIGHT + BTN_GAP) + BTN_HEIGHT / 2
      ),
      anchor('center'),
      color(255, 255, 255),
      'move-btn',
    ]);
    backBtn.onClick(() => {
      destroyAll('move-btn');
      showActionButtons();
    });
    backBtn.onHover(() => {
      backBtn.color = rgb(220, 120, 120);
    });
    backBtn.onHoverEnd(() => {
      backBtn.color = rgb(200, 100, 100);
    });
  }

  // Step 6: Bag Menu
  function showBagMenu() {
    const btnWidth = 200;
    const startX = 20;
    let yPos = MENU_BTN_START_Y;

    gameState.bag.forEach((item, i) => {
      if (item.qty > 0) {
        const itemBtn = add([
          rect(btnWidth, BTN_HEIGHT),
          pos(startX, yPos),
          color(150, 200, 100),
          outline(2, rgb(0, 0, 0)),
          area(),
          'bag-btn',
          { itemName: item.name, qty: item.qty },
        ]);

        add([
          text(`${item.name} x${item.qty}`, { size: 12, font: 'monospace' }),
          pos(startX + btnWidth / 2, yPos + BTN_HEIGHT / 2),
          anchor('center'),
          color(255, 255, 255),
          'bag-btn',
        ]);

        itemBtn.onClick(() => {
          useItem(item);
        });

        yPos += BTN_HEIGHT + BTN_GAP;
      }
    });

    // Back button
    const backBtn = add([
      rect(btnWidth, BTN_HEIGHT),
      pos(startX, yPos),
      color(200, 100, 100),
      outline(2, rgb(0, 0, 0)),
      area(),
      'bag-btn',
    ]);
    add([
      text('Back', { size: 12, font: 'monospace' }),
      pos(startX + btnWidth / 2, yPos + BTN_HEIGHT / 2),
      anchor('center'),
      color(255, 255, 255),
      'bag-btn',
    ]);
    backBtn.onClick(() => {
      destroyAll('bag-btn');
      showActionButtons();
    });
  }

  function useItem(item) {
    if (item.name === 'Potion') {
      const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
      if (playerBmon.hp >= playerBmon.maxHp) {
        showBattleMessage('HP is already full!');
        wait(2, () => {
          destroyAll('bag-btn');
          showActionButtons();
        });
      } else {
        const restored = Math.min(item.hpRestore, playerBmon.maxHp - playerBmon.hp);
        playerBmon.hp += restored;
        item.qty--;
        showBattleMessage(`Used Potion! ${playerBmon.name} recovered ${restored} HP!`);
        refreshHpBar('player');
        destroyAll('bag-btn');
        wait(2, () => {
          executeOpponentTurn();
        });
      }
    } else if (item.name === 'Capture Ball') {
      destroyAll('bag-btn');
      if (battleState.isWild) {
        const rivalBmon = battleState.wildBertymon;
        item.qty--;
        const result = attemptCapture(rivalBmon);
        showBattleMessage('You threw a Capture Ball!');
        wait(2, () => {
          if (result.captured) {
            showBattleMessage(`Gotcha! ${rivalBmon.name} was captured!`);
            gameState.playerParty.push({ ...rivalBmon });
            wait(3, () => {
              go('intro');
            });
          } else {
            showBattleMessage(`Oh no! ${rivalBmon.name} broke free!`);
            wait(2, () => {
              executeOpponentTurn();
            });
          }
        });
      } else {
        showBattleMessage("You can't capture a rival's Bertymon!");
        wait(2, () => {
          showActionButtons();
        });
      }
    }
  }

  // Step 6: Party Menu
  function showPartyMenu() {
    const btnWidth = 200;
    const startX = 20;
    let yPos = MENU_BTN_START_Y;

    gameState.playerParty.forEach((bmon, i) => {
      const isActive = i === gameState.activeBertymonIndex;
      const isFainted = bmon.hp <= 0;

      const bgColor = isActive
        ? rgb(200, 150, 100)
        : isFainted
          ? rgb(100, 100, 100)
          : rgb(150, 150, 200);
      const partyBtn = add([
        rect(btnWidth, BTN_HEIGHT),
        pos(startX, yPos),
        color(bgColor),
        outline(2, rgb(0, 0, 0)),
        area(),
        'party-btn',
      ]);

      const statusText = isActive ? ' (active)' : isFainted ? ' (fainted)' : '';
      add([
        text(`${bmon.name} HP: ${bmon.hp}/${bmon.maxHp}${statusText}`, {
          size: 12,
          font: 'monospace',
        }),
        pos(startX + btnWidth / 2, yPos + BTN_HEIGHT / 2),
        anchor('center'),
        color(255, 255, 255),
        'party-btn',
      ]);

      if (!isActive && !isFainted) {
        partyBtn.onClick(() => {
          gameState.activeBertymonIndex = i;
          showBattleMessage(`Go, ${bmon.name}!`);
          refreshBattleDisplay();
          destroyAll('party-btn');
          wait(1.5, () => {
            executeOpponentTurn();
          });
        });
      }

      yPos += BTN_HEIGHT + BTN_GAP;
    });

    // Back button (only if not forced switch)
    const backBtn = add([
      rect(btnWidth, BTN_HEIGHT),
      pos(startX, yPos),
      color(200, 100, 100),
      outline(2, rgb(0, 0, 0)),
      area(),
      'party-btn',
    ]);
    add([
      text('Back', { size: 12, font: 'monospace' }),
      pos(startX + btnWidth / 2, yPos + BTN_HEIGHT / 2),
      anchor('center'),
      color(255, 255, 255),
      'party-btn',
    ]);
    backBtn.onClick(() => {
      destroyAll('party-btn');
      showActionButtons();
    });
  }

  // Step 7: Turn Execution
  function rivalChooseMove(rivalBertymon) {
    const moves = rivalBertymon.moves.map(m => MOVES[m]);
    const damagingMoves = moves.filter(m => m.power !== null);
    const statusMoves = moves.filter(m => m.power === null);

    if (Math.random() < 0.7 && damagingMoves.length > 0) {
      return damagingMoves[Math.floor(Math.random() * damagingMoves.length)];
    } else if (statusMoves.length > 0) {
      return statusMoves[Math.floor(Math.random() * statusMoves.length)];
    } else {
      return damagingMoves[0];
    }
  }

  function executeMove(attacker, defender, move, attackerIsPlayer, onDone) {
    const defenderSide = attackerIsPlayer ? 'enemy' : 'player';
    showBattleMessage(`${attacker.name} used ${move.name}!`);

    wait(1, () => {
      if (move.power !== null) {
        const result = calculateDamage(move, attacker, defender);
        defender.hp = Math.max(0, defender.hp - result.damage);
        refreshHpBar(defenderSide);

        if (result.effectiveness === 2) {
          showBattleMessage("It's super effective!");
        } else if (result.effectiveness === 0.5) {
          showBattleMessage("It's not very effective...");
        }
      } else {
        applyMoveEffect(move, defender);
        if (move.effect === 'lowerDefense1') {
          showBattleMessage(`${defender.name}'s Defense fell!`);
        } else if (move.effect === 'lowerAttack1') {
          showBattleMessage(`${defender.name}'s Attack fell!`);
        }
      }
      wait(1, () => {
        onDone();
      });
    });
  }

  function executeTurn(playerMove) {
    battleState.phase = 'executing';
    const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
    const rivalBmon = gameState.rivalParty[0];
    const rivalMove = rivalChooseMove(rivalBmon);
    const playerFirst = playerBmon.speed >= rivalBmon.speed;

    const first = playerFirst
      ? { a: playerBmon, d: rivalBmon, m: playerMove, isP: true }
      : { a: rivalBmon, d: playerBmon, m: rivalMove, isP: false };
    const second = playerFirst
      ? { a: rivalBmon, d: playerBmon, m: rivalMove, isP: false }
      : { a: playerBmon, d: rivalBmon, m: playerMove, isP: true };

    executeMove(first.a, first.d, first.m, first.isP, () => {
      if (first.d.hp <= 0) {
        checkBattleEnd();
        return;
      }
      executeMove(second.a, second.d, second.m, second.isP, () => {
        checkBattleEnd();
      });
    });
  }

  function executeOpponentTurn() {
    battleState.phase = 'executing';
    const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
    const rivalBmon = gameState.rivalParty[0];
    const rivalMove = rivalChooseMove(rivalBmon);

    executeMove(rivalBmon, playerBmon, rivalMove, false, () => {
      checkBattleEnd();
    });
  }

  // Step 8: Battle End & Fainting
  function checkBattleEnd() {
    const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
    const rivalBmon = gameState.rivalParty[0];

    // Check player faint
    if (playerBmon.hp <= 0) {
      showBattleMessage(`${playerBmon.name} fainted!`);
      wait(2, () => {
        // Check if all player Bertymon fainted
        const allFainted = gameState.playerParty.every(b => b.hp <= 0);
        if (allFainted) {
          handleDefeat();
        } else {
          // Force switch to next non-fainted Bertymon
          showBattleMessage('Choose your next Bertymon!');
          wait(1, () => {
            showForcedPartyMenu();
          });
        }
      });
      return;
    }

    // Check rival faint
    if (rivalBmon.hp <= 0) {
      showBattleMessage(`${rivalBmon.name} fainted!`);
      wait(2, () => {
        // Check if all rival Bertymon fainted
        const allFainted = gameState.rivalParty.every(b => b.hp <= 0);
        if (allFainted) {
          handleVictory();
        } else {
          // For now, single Bertymon per side, so rival has no more
          handleVictory();
        }
      });
      return;
    }

    // Battle continues
    battleState.phase = 'action';
    showBattleMessage('What will you do?');
    showActionButtons();
  }

  function showForcedPartyMenu() {
    const btnWidth = 200;
    const startX = 20;
    let yPos = MENU_BTN_START_Y;

    gameState.playerParty.forEach((bmon, i) => {
      const isActive = i === gameState.activeBertymonIndex;
      const isFainted = bmon.hp <= 0;

      if (isFainted) {
        return;
      } // Skip fainted Bertymon

      const partyBtn = add([
        rect(btnWidth, BTN_HEIGHT),
        pos(startX, yPos),
        color(150, 150, 200),
        outline(2, rgb(0, 0, 0)),
        area(),
        'party-btn',
      ]);

      const statusText = isActive ? ' (active)' : '';
      add([
        text(`${bmon.name} HP: ${bmon.hp}/${bmon.maxHp}${statusText}`, {
          size: 12,
          font: 'monospace',
        }),
        pos(startX + btnWidth / 2, yPos + BTN_HEIGHT / 2),
        anchor('center'),
        color(255, 255, 255),
        'party-btn',
      ]);

      if (!isActive) {
        partyBtn.onClick(() => {
          gameState.activeBertymonIndex = i;
          showBattleMessage(`Go, ${bmon.name}!`);
          refreshBattleDisplay();
          destroyAll('party-btn');
          wait(1.5, () => {
            executeOpponentTurn();
          });
        });
      }

      yPos += BTN_HEIGHT + BTN_GAP;
    });
  }

  function grantCaptureBallsIfFirst() {
    const captureBallItem = gameState.bag.find(i => i.name === 'Capture Ball');
    if (!captureBallItem) {
      gameState.bag.push({ name: 'Capture Ball', qty: 5 });
      return true;
    }
    return false;
  }

  function handleVictory() {
    updateBertyBucks(gameState, true);
    showBattleMessage(`You defeated your Rival! +${BERTYBUCKS_BATTLE_REWARD} BertyBucks!`);

    // Heal all player Bertymon for the next battle
    gameState.playerParty.forEach(b => {
      b.hp = b.maxHp;
      b.statStages = { attack: 0, defense: 0 };
    });

    const gotBalls = grantCaptureBallsIfFirst();
    if (gotBalls) {
      wait(3, () => {
        showBattleMessage('Professor Willow gave you 5 Capture Balls!');
        wait(3, () => {
          go('intro');
        });
      });
    } else {
      wait(3, () => {
        go('intro');
      });
    }
  }

  function handleDefeat() {
    updateBertyBucks(gameState, false);
    showBattleMessage(`You lost the battle... -${BERTYBUCKS_BATTLE_REWARD} BertyBucks`);

    // Heal all player Bertymon for the next battle
    gameState.playerParty.forEach(b => {
      b.hp = b.maxHp;
      b.statStages = { attack: 0, defense: 0 };
    });

    const gotBalls = grantCaptureBallsIfFirst();
    if (gotBalls) {
      wait(3, () => {
        showBattleMessage('Professor Willow gave you 5 Capture Balls!');
        wait(3, () => {
          go('intro');
        });
      });
    } else {
      wait(3, () => {
        go('intro');
      });
    }
  }

  // Step 9: Battle Intro Sequence
  showBattleMessage('Rival wants to battle!');
  wait(2, () => {
    showBattleMessage(`Rival sent out ${gameState.rivalParty[0].name}!`);
    wait(2, () => {
      const playerBmon = gameState.playerParty[gameState.activeBertymonIndex];
      showBattleMessage(`Go, ${playerBmon.name}!`);
      wait(1.5, () => {
        refreshBattleDisplay();
        battleState.phase = 'action';
        showBattleMessage('What will you do?');
        showActionButtons();
      });
    });
  });
});

// Start the game
gameState.currentScene = 'intro';
go('intro');

// Expose gameState for testing (after kaplay context is created)
if (typeof window !== 'undefined') {
  window.gameState = gameState;
}
