# Bertymon Gameplay Spec

## Overview

Bertymon is a Pokemon-inspired RPG where the player (Berty) receives a starter Bertymon from Professor Willow and embarks on an adventure. The game features a type-triangle battle system, a rival trainer, and turn-based combat.

## Core Mechanics

### Type System

Three types form a rock-paper-scissors triangle:

```
Grass  ──beats──▶  Water
  ▲                  │
  │                  │
  │               beats
beats                │
  │                  ▼
Fire  ◀──beats───  (Fire)
```

- **Grass** is strong against **Water**
- **Water** is strong against **Fire**
- **Fire** is strong against **Grass**

A super-effective attack deals **2x** damage. A not-very-effective attack deals **0.5x** damage. Normal-type moves are neutral against all types (1x).

### Bertymon

There are three Bertymon, each corresponding to a type:

| Name       | Type  | Sprite          |
|------------|-------|-----------------|
| Treebeast  | Grass | Treebeast.png   |
| Aquawing   | Water | Aquawing.png    |
| Flarepup   | Fire  | Flarepup.png    |

#### Stats

Each Bertymon has the following stats:

- **HP** (Hit Points): Determines how much damage a Bertymon can take before fainting. Starts at **100** for all starters.
- **Attack**: Affects damage dealt by moves. Base value: **50** for all starters.
- **Defense**: Reduces damage received. Base value: **50** for all starters.
- **Speed**: Determines who goes first in battle. Treebeast: **45**, Aquawing: **50**, Flarepup: **55**.

Stats can be modified in battle by "stages" (from -6 to +6). Each positive stage multiplies the stat by (2+stage)/2, and each negative stage multiplies by 2/(2+|stage|). For example, -1 defense means the defense stat is multiplied by 2/3.

#### Moves

Each Bertymon knows three moves:

**Treebeast (Grass):**
| Move         | Type   | Power | Effect                                       |
|--------------|--------|-------|----------------------------------------------|
| Leafage      | Grass  | 50    | Deals damage                                 |
| Quick Attack | Normal | 40    | Deals damage                                 |
| Leer         | Normal | --    | Lowers opponent's Defense by 1 stage          |

**Flarepup (Fire):**
| Move         | Type   | Power | Effect                                       |
|--------------|--------|-------|----------------------------------------------|
| Ember        | Fire   | 50    | Deals damage                                 |
| Quick Attack | Normal | 40    | Deals damage                                 |
| Tail Wag     | Normal | --    | Lowers opponent's Attack and Sp. Atk by 1 stage |

**Aquawing (Water):**
| Move         | Type   | Power | Effect                                       |
|--------------|--------|-------|----------------------------------------------|
| Water Gun    | Water  | 50    | Deals damage                                 |
| Quick Attack | Normal | 40    | Deals damage                                 |
| Leer         | Normal | --    | Lowers opponent's Defense by 1 stage          |

#### Damage Formula

```
damage = (move_power * (attacker_attack / defender_defense)) * type_effectiveness
```

Where `attacker_attack` and `defender_defense` are the stat values after applying stage modifiers. Type effectiveness is 2.0 (super effective), 1.0 (neutral), or 0.5 (not very effective).

A message displays after each attack indicating effectiveness:
- "It's super effective!" (2x)
- "It's not very effective..." (0.5x)
- (no message for neutral)

#### Fainting

When a Bertymon's HP reaches 0, it faints and can no longer battle. The trainer must switch to another Bertymon (if available) or loses the battle.

### Leveling (Simple)

Bertymon do not level up in the initial version. All Bertymon remain at their base stats throughout the game. (Leveling may be added later.)

## Game Flow

### 1. Intro / Overworld

The player starts in the overworld and can walk around. Professor Willow stands near his lab. The player can talk to the professor or enter the lab.

### 2. Starter Selection (Lab Scene)

Inside the lab, three starter Bertymon are displayed on tables. The player walks up to one and presses SPACE (or taps SEL) to choose it.

### 3. Rival Appears

**Immediately after** the player chooses their starter, the rival appears. The rival picks the starter that is **strong against** the player's choice:

| Player chooses | Rival chooses |
|----------------|---------------|
| Treebeast (Grass) | Flarepup (Fire)  |
| Aquawing (Water)  | Treebeast (Grass) |
| Flarepup (Fire)   | Aquawing (Water)  |

The rival says: **"Let's battle!"** and a battle begins immediately.

### 4. Battle System

Battles are the core gameplay loop. They can be **trainer battles** (e.g., the rival) or **wild encounters** (future feature).

#### Battle Screen Layout

The battle screen shows:
- **Opponent's Bertymon** in the upper-right area, with its name, HP bar, and type
- **Player's Bertymon** in the lower-left area, with its name, HP bar, and type
- **Action buttons** along the bottom of the screen
- **Message box** showing battle text ("Flarepup used Ember!", etc.)

#### Action Buttons

For **trainer battles**, three buttons appear:
1. **Battle** -- Opens the move list; the player picks a move to use
2. **Bertymon** -- Opens the party list to switch the active Bertymon (fainted Bertymon are grayed out and cannot be selected)
3. **Bag** -- Opens the inventory to use an item on the active Bertymon

For **wild battles** (future), a fourth button is added:
4. **Run** -- Flee from the battle (always succeeds)

#### Turn Order

Each turn:
1. The player selects an action (move, switch, or use item).
2. The opponent selects an action (AI-controlled).
3. Actions resolve. The faster Bertymon's move goes first (based on Speed stat). Switching and item usage always happen before attacks.

#### Rival AI (Simple)

The rival AI is intentionally easy to beat:
- **70% of the time**: Uses a random damaging move
- **30% of the time**: Uses a status move (Leer or Tail Wag)
- Never switches Bertymon (the rival only has one Bertymon in the initial version)
- Never uses items

### 5. Battle Resolution

#### Winning

If the player defeats all of the opponent's Bertymon, the player wins. A victory message displays (e.g., "You defeated your Rival!"). After the rival battle, the player returns to the overworld.

#### Losing

If all of the player's Bertymon faint, the player loses. A defeat message displays. The player's Bertymon are healed to full HP and the player returns to the overworld. (No penalty for losing.)

### 6. Post-Battle / Overworld (Future)

After the rival battle, the game currently ends with a congratulations message. Future features would include:
- Additional routes with wild Bertymon encounters
- More trainers to battle
- A Bertymon Center for healing
- Additional Bertymon to catch
- Gyms and badges

## Inventory / Bag

The bag system allows the player to carry and use items. In the initial version, the bag starts with:

| Item     | Qty | Effect                              |
|----------|-----|-------------------------------------|
| Potion   | 3   | Restores 20 HP to the active Bertymon |

Items are used during battle via the **Bag** button. Using an item consumes the player's turn.

## Controls

- **Arrow keys** (desktop) or **on-screen D-pad** (touch): Move the player in the overworld
- **SPACE** (desktop) or **SEL button** (touch): Interact / confirm selections
- In battle, the player taps/clicks the action buttons directly

---

## Appendix A: Framework Evaluation

### Current Framework: Kaplay (v3001.0)

**Kaplay** is a lightweight 2D JavaScript game library. It provides:
- Scene management (`scene()`, `go()`)
- Sprite loading and rendering
- Input handling (keyboard and mouse/touch)
- Entity-component system (`add()`, `area()`, `body()`, etc.)
- Text rendering
- Basic UI primitives (rectangles, colors, outlines)

**Pros:**
- Already in use; no migration cost
- Lightweight and simple -- appropriate for a kid-designed game
- Scene system maps naturally to RPG screens (overworld, lab, battle)
- Good touch/mobile support (important since the game targets iPad)
- No build step required -- just serve static files
- PWA-ready (manifest.json already configured)

**Cons:**
- Less battle-specific tooling than a full RPG engine
- No built-in UI widget system (menus, HP bars must be hand-coded)
- Smaller community than Phaser

### Alternative: Phaser (v3)

**Pros:**
- Larger ecosystem, more tutorials and examples
- Built-in tweens, cameras, particle effects
- More robust input handling

**Cons:**
- Significantly heavier (~1MB vs Kaplay's ~200KB)
- More complex API; higher learning curve
- Would require rewriting everything from scratch
- Overkill for this game's scope

### Alternative: Vanilla Canvas / DOM

**Pros:**
- Zero dependencies
- Maximum control

**Cons:**
- Massive amount of boilerplate for input, rendering, scenes
- Would need to rewrite everything
- Reinventing wheels that Kaplay already provides

### Recommendation

**Keep Kaplay.** It is well-suited for this game. The existing code is clean and functional. The scene system, sprite loading, and input handling all work well. The missing features (battle UI, HP bars, menus) are straightforward to build on top of Kaplay's primitives. Migrating to a different framework would cost significant time with no clear benefit.

---

## Appendix B: Implementation Plan

Tasks are ordered by dependency. Each step should be completed before starting steps that depend on it. Steps at the same level within a group are independent and can be done in parallel.

### Step 1: Pure Data & Helper Functions (no dependencies)

These are pure JavaScript -- no Kaplay code, no DOM, no rendering. Add them near the top of `game.js`, after the `loadSprite` calls and before `gameState`.

- [ ] **1a. Define move data.** Create a `const MOVES` object mapping move names to `{ name, type, power, effect }`. `power` is a number for damaging moves or `null` for status moves. `effect` is `null` for damaging moves, or a string like `"lowerDefense1"` or `"lowerAttack1"`. The moves are: `Leafage` (Grass, 50, null), `Ember` (Fire, 50, null), `WaterGun` (Water, 50, null), `QuickAttack` (Normal, 40, null), `Leer` (Normal, null, "lowerDefense1"), `TailWag` (Normal, null, "lowerAttack1").

- [ ] **1b. Define Bertymon templates.** Create a `const BERTYMON_TEMPLATES` object mapping names to `{ name, type, sprite, hp, attack, defense, speed, moves }`. All three starters have hp:100, attack:50, defense:50. Speeds: Treebeast:45, Aquawing:50, Flarepup:55. Moves (arrays of keys into `MOVES`): Treebeast: ["Leafage","QuickAttack","Leer"], Flarepup: ["Ember","QuickAttack","TailWag"], Aquawing: ["WaterGun","QuickAttack","Leer"]. `sprite` is the Kaplay sprite name already loaded (e.g., `"treebeast"`).

- [ ] **1c. Write `createBertymon(templateName)`.** Returns a new object: copies all fields from the template, adds `maxHp` (equal to `hp`), and adds `statStages: { attack: 0, defense: 0 }`. Must return a fresh object each call (not a reference to the template).

- [ ] **1d. Write `getTypeEffectiveness(attackType, defenderType)`.** Returns `2` if super effective, `0.5` if not very effective, `1` otherwise. The rules: Grass>Water, Water>Fire, Fire>Grass. Normal is always 1. If attackType equals defenderType, return 1.

- [ ] **1e. Write `getStatWithStages(baseStat, stage)`.** `stage` is an integer from -6 to +6. If stage >= 0, return `baseStat * (2 + stage) / 2`. If stage < 0, return `baseStat * 2 / (2 + Math.abs(stage))`. Return value should be floored to an integer with `Math.floor`.

- [ ] **1f. Write `calculateDamage(move, attacker, defender)`.** Only for moves with `power !== null`. Formula: `Math.floor(move.power * (effectiveAttack / effectiveDefense) * typeEffectiveness)`. Use `getStatWithStages` for attack/defense. Use `getTypeEffectiveness(move.type, defender.type)`. Minimum damage is 1. Return `{ damage, effectiveness }` where effectiveness is the multiplier (2, 1, or 0.5).

- [ ] **1g. Write `getRivalStarter(playerStarterName)`.** Returns the template name of the rival's starter. Mapping: Treebeast→Flarepup, Flarepup→Aquawing, Aquawing→Treebeast.

- [ ] **1h. Write `applyMoveEffect(move, target)`.** For status moves (power is null). If effect is `"lowerDefense1"`: decrease `target.statStages.defense` by 1, min -6. If effect is `"lowerAttack1"`: decrease `target.statStages.attack` by 1, min -6.

### Step 2: Expand Game State (depends on Step 1)

- [ ] **2a. Expand `gameState`.** Add fields: `playerParty: []` (array of Bertymon instances), `rivalParty: []`, `bag: [{ name: "Potion", qty: 3, hpRestore: 20 }]`, `activeBertymonIndex: 0` (index into playerParty of the currently active Bertymon).

### Step 3: Update Starter Selection to Use Data Model (depends on Step 2)

Modify the existing `selectStarter()` function inside the `"lab"` scene.

- [ ] **3a. Create Bertymon instances on selection.** In `selectStarter()`, after setting `gameState.hasStarterBertymon = true`, call `createBertymon(starterData.name)` and push the result into `gameState.playerParty`. Also call `createBertymon(getRivalStarter(starterData.name))` and push into `gameState.rivalParty`.

- [ ] **3b. Show rival dialog.** After the "Congratulations" dialog auto-closes (in the existing `wait(3, ...)` callback), destroy the congratulations text and instead show a new dialog: "Rival: I'll take [rival's Bertymon name]! Let's battle!" Display this for 3 seconds, then call `go("battle")`.

### Step 4: Battle Scene Layout (depends on Steps 1-2)

Create a new `scene("battle", () => { ... })` in `game.js`, after the `"lab"` scene.

- [ ] **4a. Render the battle background.** Fill the scene with a flat color (e.g., a light gray `[220,220,220]` rectangle covering the full canvas).

- [ ] **4b. Render opponent's Bertymon.** In the upper-right area (~pos 550,120), show the opponent's active Bertymon sprite (from `gameState.rivalParty[0]`), its name as a text label above, and its type in parentheses. Tag these with `"enemy-display"`.

- [ ] **4c. Render player's Bertymon.** In the lower-left area (~pos 150,320), show the player's active Bertymon sprite (from `gameState.playerParty[gameState.activeBertymonIndex]`), its name as a text label above, and its type in parentheses. Tag these with `"player-display"`.

- [ ] **4d. Render HP bars.** For each side, draw an HP bar: an outer rectangle (border) and an inner filled rectangle whose width is proportional to `hp/maxHp`. Use green for >50%, yellow for 20-50%, red for <20%. Show "HP: X/Y" as text next to each bar. Tag with `"enemy-hp"` / `"player-hp"`.

- [ ] **4e. Render the message box.** A white rectangle with black outline at the bottom of the screen (y ~450, full width minus margins, ~100px tall). Inside, a text object tagged `"battle-msg"` that displays battle messages. Create a helper function `showBattleMessage(msg)` that sets the text content of the `"battle-msg"` object.

- [ ] **4f. Render the action buttons.** Above the message box (y ~430), show 3 buttons side by side: "Battle", "Bertymon", "Bag". Each is a rect with a text label, tagged `"action-btn"`. Use `area()` and `onClick()` for each. Style them as dark rectangles with white text (similar to the D-pad buttons).

### Step 5: Battle - Move Selection (depends on Step 4)

- [ ] **5a. "Battle" button handler.** When clicked, hide all `"action-btn"` objects (set `opacity(0)` or destroy and re-create later). Show 3 move buttons (one per move of the active Bertymon) plus a "Back" button. Tag these `"move-btn"`. Each move button shows the move name and type.

- [ ] **5b. "Back" button in move menu.** Destroys all `"move-btn"` objects and re-shows the action buttons.

- [ ] **5c. Move button handler.** When a move button is clicked, store the chosen move, then call `executeTurn(chosenMove)` (implemented in Step 7).

### Step 6: Battle - Bag & Switch Menus (depends on Step 4)

- [ ] **6a. "Bag" button handler.** When clicked, hide action buttons. Show a list of items from `gameState.bag` (only items with qty > 0), each as a button showing "ItemName x Qty". Add a "Back" button. Tag all with `"bag-btn"`.

- [ ] **6b. Potion item handler.** When a potion button is clicked: if the active Bertymon's HP is already full, show message "HP is already full!" and return to action buttons. Otherwise, increase HP by `hpRestore` (capped at maxHp), decrease qty by 1, show message "Used Potion! [Name] recovered X HP!", then let the opponent take their turn (call `executeOpponentTurn()`).

- [ ] **6c. "Bertymon" button handler.** When clicked, hide action buttons. Show a list of all Bertymon in `gameState.playerParty`, each as a button showing "Name HP: X/Y". Fainted Bertymon (hp <= 0) should be grayed out (color: gray, no onClick). The currently active Bertymon should show "(active)" and not be clickable. Add a "Back" button. Tag all with `"party-btn"`.

- [ ] **6d. Switch handler.** When a non-fainted, non-active party member is clicked: set `gameState.activeBertymonIndex` to that Bertymon's index, show message "Go, [Name]!", refresh the player-side display (sprite, name, HP bar), then let the opponent take their turn (call `executeOpponentTurn()`).

### Step 7: Turn Execution (depends on Steps 5 and 6)

- [ ] **7a. Write `rivalChooseMove(rivalBertymon)`.** Returns a move object. 70% chance: pick a random move from the Bertymon's moves that has `power !== null`. 30% chance: pick a random move that has `power === null`. If the chosen category has no moves, fall back to the other category.

- [ ] **7b. Write `executeTurn(playerMove)`.** This is the core turn loop. Get the player's active Bertymon and the rival's active Bertymon. Call `rivalChooseMove()` to get the rival's move. Compare speeds to determine who goes first (player goes first on tie). Then execute each move in order using `executeMove()`. Between the two moves, check if the target fainted (see Step 8). Use `wait()` calls (e.g., 1.5s between actions) so messages are readable.

- [ ] **7c. Write `executeMove(attacker, defender, move, attackerIsPlayer)`.** If the move has power: call `calculateDamage()`, subtract damage from `defender.hp` (min 0), show message "[Attacker] used [Move]!", then show effectiveness message if not 1.0, then update the defender's HP bar. If the move has no power: call `applyMoveEffect(move, defender)`, show message "[Attacker] used [Move]!", then show effect message (e.g., "[Defender]'s defense fell!").

- [ ] **7d. Write `refreshHpBar(side)`.** `side` is `"player"` or `"enemy"`. Destroys old HP bar objects for that side and redraws them based on current HP values. Called after any HP change.

- [ ] **7e. Write `refreshBattleDisplay()`.** Refreshes both sides' sprites, names, and HP bars. Called after switching Bertymon.

### Step 8: Fainting & Battle End (depends on Step 7)

- [ ] **8a. Fainting check after each move.** After `executeMove()`, if `defender.hp <= 0`, show "[Name] fainted!". If the defender is the rival's Bertymon: check if all `gameState.rivalParty` Bertymon have hp <= 0. If yes → player wins (Step 8c). If the defender is the player's Bertymon: check if all `gameState.playerParty` Bertymon have hp <= 0. If yes → player loses (Step 8d). Otherwise, force the player to switch (show the party menu with only non-fainted Bertymon clickable, no Back button).

- [ ] **8b. Skip second move if first move causes a faint.** In `executeTurn()`, after the first move resolves, check if the target fainted. If so, skip the second move and go straight to fainting resolution.

- [ ] **8c. Victory.** Show "You defeated your Rival!" in the message box. After 3 seconds, call `go("intro")` to return to the overworld.

- [ ] **8d. Defeat.** Show "You lost the battle..." in the message box. Heal all player Bertymon to full HP (set `hp = maxHp`, reset `statStages` to 0). After 3 seconds, call `go("intro")` to return to the overworld.

### Step 9: Polish (depends on all above)

- [ ] **9a. Battle intro text.** At the start of the battle scene, before showing action buttons, show "Rival wants to battle!" for 2 seconds, then "Rival sent out [Name]!" for 2 seconds, then "Go, [Name]!" for 1.5 seconds, then show the action buttons.
- [ ] **9b. Touch-friendly button sizing.** Make all battle buttons at least 60px tall and 120px wide with 8px gaps, so they are easy to tap on iPad.
- [ ] **9c. Button press feedback.** On `onHover` / `onClick`, briefly change button color to a lighter shade, then revert.
- [ ] **9d. End-to-end test.** Manually play through the full loop: intro → lab → pick starter → rival dialog → battle → win → overworld. Verify all messages display, HP bars update, fainting works, and the game doesn't crash.
