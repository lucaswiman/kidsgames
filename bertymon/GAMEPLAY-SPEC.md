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

### Phase 1: Data Model & Game State

- [ ] Define Bertymon data structures (name, type, hp, maxHp, attack, defense, speed, moves, statStages)
- [ ] Define Move data structures (name, type, power, effect)
- [ ] Create the three starter Bertymon templates with their stats and moves
- [ ] Expand `gameState` to include: player's party (array of Bertymon), rival's party, inventory/bag
- [ ] Initialize bag with 3 Potions on game start

### Phase 2: Rival & Starter Selection Flow

- [ ] After the player selects a starter, create a Bertymon instance and add it to the player's party
- [ ] Determine the rival's starter based on the player's choice (type advantage)
- [ ] Show the rival character entering the lab (simple sprite + walk-in animation or immediate appearance)
- [ ] Display rival dialog: "Let's battle!"
- [ ] Transition to the battle scene

### Phase 3: Battle Scene - Layout & UI

- [ ] Create a `"battle"` scene in Kaplay
- [ ] Render the opponent's Bertymon sprite (upper-right) with name label and HP bar
- [ ] Render the player's Bertymon sprite (lower-left) with name label and HP bar
- [ ] Build a message box area at the bottom for battle text
- [ ] Build the action button panel: Battle, Bertymon, Bag (3 buttons for trainer battle)
- [ ] Wire up button clicks/taps to open sub-menus

### Phase 4: Battle Scene - Move Selection & Combat

- [ ] When "Battle" is pressed, show the active Bertymon's 3 moves as buttons
- [ ] Implement the damage formula: `power * (attack / defense) * type_effectiveness`
- [ ] Implement stat stage modifiers for Attack and Defense
- [ ] Implement type effectiveness lookup (Grass>Water, Water>Fire, Fire>Grass)
- [ ] Display effectiveness messages ("It's super effective!", "It's not very effective...")
- [ ] Implement turn resolution: compare speeds, execute moves in order
- [ ] Animate HP bar decreasing when damage is dealt
- [ ] Show move name in message box (e.g., "Flarepup used Ember!")
- [ ] Handle Leer effect (lower opponent's Defense by 1 stage)
- [ ] Handle Tail Wag effect (lower opponent's Attack by 1 stage)

### Phase 5: Battle Scene - Switching & Items

- [ ] When "Bertymon" is pressed, show the player's party with HP status
- [ ] Allow switching to a non-fainted Bertymon (consumes the player's turn)
- [ ] Gray out / disable fainted Bertymon in the switch menu
- [ ] When "Bag" is pressed, show inventory items with quantities
- [ ] Implement Potion usage: restore 20 HP (capped at maxHp), consume 1 Potion, consume the turn
- [ ] Show appropriate messages ("Used Potion on Treebeast!", "Treebeast recovered 20 HP!")

### Phase 6: Rival AI

- [ ] Implement simple AI: 70% chance to use a random damaging move, 30% chance to use a status move
- [ ] AI never switches or uses items
- [ ] AI selects its action after the player selects theirs

### Phase 7: Battle Resolution

- [ ] Detect when a Bertymon faints (HP <= 0): show "{name} fainted!" message
- [ ] If the player's active Bertymon faints, force a switch (or lose if no Bertymon remain)
- [ ] If the opponent's last Bertymon faints, the player wins
- [ ] Show victory message: "You defeated your Rival!"
- [ ] Show defeat message: "You lost the battle..." and heal all player Bertymon to full HP
- [ ] Transition back to the overworld (or show end-of-game message) after the battle

### Phase 8: Polish & Playability

- [ ] Add a brief intro animation or text when the battle starts ("Rival wants to battle!")
- [ ] Add a "Back" button to sub-menus (move list, party, bag) to return to the main action menu
- [ ] Ensure touch controls work well on iPad (button sizing, spacing)
- [ ] Add visual feedback for button presses (color change on tap)
- [ ] Test full gameplay loop: intro -> lab -> pick starter -> rival appears -> battle -> win/lose -> end
