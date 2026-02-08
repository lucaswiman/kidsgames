# Bertymon Battle System - Testing Guide

This guide provides step-by-step instructions to manually test the complete battle system implementation.

## Pre-Testing Checklist

- [ ] Load the game in a web browser (e.g., via `python3 -m http.server` and navigate to `localhost:8000/bertymon/index.html`)
- [ ] Ensure sprites are visible in the intro and lab scenes
- [ ] Open browser console (F12) to check for any JavaScript errors

## Test Scenarios

### Scenario 1: Intro to Lab Flow

**Goal**: Verify starter selection and Bertymon instance creation

1. [ ] Game loads to intro scene with grass background
2. [ ] Click/tap on Professor to see dialog: "Head to my lab to choose your first companion!"
3. [ ] Click/tap on Lab building to enter lab scene
4. [ ] Lab scene displays three starters (Flarepup, Aquawing, Treebeast)
5. [ ] Each starter shows name and type below sprite

**Expected Behavior**: All sprites and dialogs display correctly with no console errors

---

### Scenario 2: Starter Selection and Rival Counter-Pick

**Goal**: Verify Bertymon creation and rival counter-picking logic

**Test Case 2a**: Choose Treebeast (Grass)

1. [ ] Walk to Treebeast and press SPACE
2. [ ] Dialog shows: "Congratulations! You chose Treebeast! Your adventure begins now!"
3. [ ] After 3 seconds, dialog shows: "Rival: I'll take Flarepup! Let's battle!"
   - Expected: Rival chooses **Flarepup (Fire)** since Fire > Grass
4. [ ] After 3 seconds, game transitions to battle scene

**Test Case 2b**: Choose Flarepup (Fire)

1. [ ] Restart game and choose Flarepup
2. [ ] Rival should pick **Aquawing (Water)** since Water > Fire

**Test Case 2c**: Choose Aquawing (Water)

1. [ ] Restart game and choose Aquawing
2. [ ] Rival should pick **Treebeast (Grass)** since Grass > Water

**Expected Behavior**: Rival always picks the type that has advantage using `getRivalStarter()`

---

### Scenario 3: Battle Scene Layout

**Goal**: Verify battle scene UI elements are displayed correctly

1. [ ] Background is light gray (220, 220, 220)
2. [ ] Opponent Bertymon sprite appears in upper-right (~550, 100)
3. [ ] Opponent name and type displayed above sprite (e.g., "Flarepup (Fire)")
4. [ ] Opponent HP bar visible with format: "HP: 100/100"
5. [ ] Player Bertymon sprite appears in lower-left (~150, 350)
6. [ ] Player name and type displayed (e.g., "Treebeast (Grass)")
7. [ ] Player HP bar visible with same format
8. [ ] Message box at bottom with initial message: "Rival wants to battle!"
9. [ ] After message sequence completes, three action buttons visible:
    - [ ] "Battle" button (top-left, 120x60px)
    - [ ] "Bertymon" button (middle, 120x60px)
    - [ ] "Bag" button (top-right, 120x60px)

**Expected Behavior**: All elements positioned and visible with correct information

---

### Scenario 4: Battle Intro Sequence

**Goal**: Verify timed intro messages display correctly

1. [ ] Message shows: "Rival wants to battle!" (2 seconds)
2. [ ] Message shows: "Rival sent out [Opponent Name]!" (2 seconds)
3. [ ] Message shows: "Go, [Player Name]!" (1.5 seconds)
4. [ ] Action buttons appear after intro sequence completes
5. [ ] Console shows no timing errors

**Expected Behavior**: Messages display in correct order with proper timing

---

### Scenario 5: Move Selection and Basic Attack

**Goal**: Verify move selection UI and basic attack execution

**Setup**: Start any battle

1. [ ] Click "Battle" button
2. [ ] Action buttons disappear
3. [ ] Move buttons appear showing:
    - [ ] "Leafage (Grass)" [OR "Ember (Fire)" OR "Water Gun (Water)" depending on player Bertymon]
    - [ ] "Quick Attack (Normal)"
    - [ ] "Leer (Normal)" [OR "Tail Wag (Normal)" for Flarepup]
    - [ ] "Back" button

**Move Selection - Example with Treebeast vs Flarepup**:

1. [ ] Click "Leafage (Grass)"
2. [ ] Message shows: "Treebeast used Leafage!"
3. [ ] Wait 1 second
4. [ ] Determine turn order:
    - If player is faster: Player attacks first, then rival attacks
    - If rival is faster: Rival attacks first, then player attacks
5. [ ] After player move:
    - Message shows damage effectiveness:
      - "It's super effective!" (Grass > Fire, 2x damage) ✅
      - Or "It's not very effective..." (if applicable)
    - [ ] Opponent HP bar updates and decreases
6. [ ] Wait 2 seconds
7. [ ] Rival attacks with a move (randomly chosen):
    - [ ] Message shows: "[Rival Name] used [Move Name]!"
    - [ ] Player HP bar updates
8. [ ] After rival move:
    - [ ] Message shows effectiveness (if applicable)
9. [ ] Action buttons reappear at bottom
10. [ ] Battle continues normally

**Test Different Move Types**:

- [ ] **Damaging Move**: Leafage, Ember, Water Gun, Quick Attack
  - Should show effectiveness message and deal damage
- [ ] **Status Move**: Leer, Tail Wag
  - Should show stat change message without dealing damage
  - Example: "Treebeast's Defense fell!" [Attack raised at player, etc.]

**Expected Behavior**: Moves execute correctly with proper damage calculation and effectiveness

---

### Scenario 6: Type Effectiveness and Damage Calculation

**Goal**: Verify type effectiveness triangle and damage multipliers

**Test Case 6a**: Grass vs Water (Super Effective)

1. [ ] Treebeast (Grass) uses Leafage vs Aquawing (Water)
2. [ ] Message: "It's super effective!"
3. [ ] Damage dealt is approximately 2x base
4. [ ] Compare HP reduction to not-very-effective case

**Test Case 6b**: Grass vs Fire (Not Very Effective)

1. [ ] Treebeast (Grass) uses Leafage vs Flarepup (Fire)
2. [ ] Message: "It's not very effective..."
3. [ ] Damage dealt is approximately 0.5x base
4. [ ] Should deal less damage than super effective

**Test Case 6c**: Normal Type (No Effectiveness Modifier)

1. [ ] Any Bertymon uses Quick Attack
2. [ ] No effectiveness message displayed
3. [ ] Damage is standard (1x multiplier)

**Expected Behavior**: Type triangle works (Grass > Water > Fire > Grass) with correct multipliers

---

### Scenario 7: HP Bar Color Coding

**Goal**: Verify HP bars change color based on remaining health

1. [ ] When HP > 50%: Bar is **green** (50, 200, 50)
2. [ ] When HP between 20-50%: Bar is **yellow** (255, 200, 0)
3. [ ] When HP < 20%: Bar is **red** (255, 50, 50)

**Testing**:

- [ ] Attack the opponent until HP < 50% and observe color change to yellow
- [ ] Continue attacking until HP < 20% and observe color change to red
- [ ] Check that player HP bar also updates color appropriately

**Expected Behavior**: HP bars change color correctly based on thresholds

---

### Scenario 8: Turn Order (Speed-Based)

**Goal**: Verify turn order is determined by Speed stat

**Setup**: Get Flarepup (Speed 55) vs Aquawing (Speed 50)

**Test Case 8a**: Faster Bertymon Attacks First

1. [ ] Flarepup (Speed 55) should attack before Aquawing (Speed 50)
2. [ ] Observe message order:
    - "Flarepup used Ember!"
    - (Effectiveness message)
    - (Aquawing's message)

**Test Case 8b**: Equal Speed

1. [ ] If both Bertymon have same speed (unlikely with defaults), either can go first
2. [ ] Observe that one attacks before the other

**Expected Behavior**: Faster Bertymon (higher Speed stat) always acts first

---

### Scenario 9: Bag - Item Usage (Potion)

**Goal**: Verify Potion usage from bag

**Setup**: Start battle with player at less than full HP

1. [ ] Click "Bag" button
2. [ ] Bag menu appears showing: "Potion x3"
3. [ ] Click "Potion x3"
4. [ ] Message shows: "Used Potion! [Name] recovered X HP!"
5. [ ] Player HP bar increases
6. [ ] Item count updates: "Potion x2"
7. [ ] Rival immediately gets their turn (no action buttons in between)
8. [ ] Rival attacks and battle continues

**Test Case 9a**: Potion When HP is Full

1. [ ] Healing player with potions until HP is full
2. [ ] Click "Bag" > "Potion"
3. [ ] Message shows: "HP is already full!"
4. [ ] No damage taken to rival
5. [ ] Action buttons reappear (item not consumed)

**Test Case 9b**: Use Multiple Potions

1. [ ] Use potions multiple times
2. [ ] Each usage decreases qty by 1
3. [ ] After using all 3 potions, "Potion x0" should no longer appear in menu

**Expected Behavior**: Potions restore correct amount of HP, quantity updates, validation prevents overheal

---

### Scenario 10: Party Switching

**Goal**: Verify Bertymon switching mechanics

**Note**: Current implementation has only 1 Bertymon per side, but UI supports multiple

1. [ ] Click "Bertymon" button
2. [ ] Party menu shows:
    - [ ] Active Bertymon: "Treebeast HP: 100/100 (active)" - grayed out, not clickable
    - [ ] "Back" button
3. [ ] If you had multiple Bertymon in party (would need to add more):
    - [ ] Non-active, non-fainted Bertymon: Clickable with normal background
    - [ ] Fainted Bertymon: Grayed out, not clickable, marked "(fainted)"

**Testing with Multiple Bertymon** (requires code modification to add more):

1. [ ] Click an inactive, non-fainted Bertymon
2. [ ] Message shows: "Go, [Name]!"
3. [ ] Player display sprite updates to new Bertymon
4. [ ] Name and type update
5. [ ] HP bar updates to new Bertymon's HP
6. [ ] Rival immediately attacks (no action buttons in between)

**Expected Behavior**: Switching displays correct Bertymon and gives rival a turn

---

### Scenario 11: Fainting and Battle End

**Goal**: Verify fainting detection and battle resolution

**Test Case 11a**: Player Wins

1. [ ] Reduce opponent HP to 0
2. [ ] Message shows: "[Opponent Name] fainted!"
3. [ ] Wait 2 seconds
4. [ ] Message shows: "You defeated your Rival!"
5. [ ] Wait 3 seconds
6. [ ] Game returns to intro scene
7. [ ] Verify you can play another battle

**Test Case 11b**: Player Loses

1. [ ] Let opponent defeat your Bertymon (reduce player HP to 0)
2. [ ] Message shows: "Treebeast fainted!"
3. [ ] Message shows: "You lost the battle..."
4. [ ] Wait 3 seconds
5. [ ] Game returns to intro scene
6. [ ] Verify player HP bars are fully restored (100/100) for next battle

**Test Case 11c**: Forced Bertymon Switch on Faint

1. [ ] With multiple Bertymon in party (requires code modification):
    - [ ] First Bertymon faints
    - [ ] Message shows: "Choose your next Bertymon!"
    - [ ] Party menu appears with only non-fainted options, no "Back" button
    - [ ] Select a new Bertymon
    - [ ] Rival attacks immediately

**Expected Behavior**: Fainting handled correctly, battle end or forced switch functions properly

---

### Scenario 12: Stat Stages (Status Moves)

**Goal**: Verify stat stage modifiers apply and affect damage

**Setup**: Use a status move like Leer or Tail Wag

1. [ ] Player uses Leer (lowers opponent Defense)
2. [ ] Message shows: "[Opponent Name]'s Defense fell!"
3. [ ] Player's next attack should deal slightly more damage (due to lower defense)
4. [ ] Compare damage with previous turn

**Test Defense Reduction**:

- [ ] Treebeast uses Leer on Flarepup
- [ ] Flarepup's defense is reduced by 1 stage
- [ ] Next Treebeast attack should deal ~7.5% more damage (1.5 multiplier for 1 stage)

**Expected Behavior**: Status moves apply stat changes and affect subsequent damage calculations

---

### Scenario 13: Rival AI Move Selection

**Goal**: Verify rival AI chooses moves (70% damaging, 30% status)

1. [ ] Play multiple turns and observe rival move patterns
2. [ ] Over many turns, rival should use:
    - [ ] ~70% damaging moves (Leafage, Ember, Water Gun, Quick Attack)
    - [ ] ~30% status moves (Leer, Tail Wag)
3. [ ] No move should cause crashes or invalid damage calculations
4. [ ] Check console for any errors in `rivalChooseMove()`

**Expected Behavior**: Rival AI makes appropriate random choices

---

### Scenario 14: Edge Cases and Error Handling

**Test Case 14a**: Attack with Fainted Bertymon

1. [ ] If forced to switch and player has no non-fainted Bertymon:
    - [ ] Should trigger defeat immediately
    - [ ] No crash or infinite loop

**Test Case 14b**: Button Spam

1. [ ] Rapidly click multiple buttons during battle
2. [ ] Should handle gracefully without crashes
3. [ ] Only one action should execute per turn

**Test Case 14c**: Move Execution After Battle End

1. [ ] Let opponent faint
2. [ ] Quickly try to click buttons
3. [ ] Should not process additional moves
4. [ ] Return to intro should proceed normally

**Expected Behavior**: Edge cases handled gracefully without crashes

---

## Console Logging for Debugging

Add console logs to verify calculations:

```javascript
// In calculateDamage():
console.log(`${attacker.name} attacks ${defender.name} for ${damage} damage`);
console.log(`Type effectiveness: ${effectiveness}x`);
```

Check console output for unexpected values or errors.

---

## Summary Checklist

- [ ] Intro → Lab → Starter selection → Battle flow works end-to-end
- [ ] All three starter options can be selected with correct rival counter-picks
- [ ] Battle UI displays all elements correctly
- [ ] Type effectiveness triangle works (Grass > Water > Fire > Grass)
- [ ] Damage calculation accounts for stats, stages, and effectiveness
- [ ] HP bars update visually and change color appropriately
- [ ] Turn order is determined by Speed stat
- [ ] Moves execute with proper messages and effects
- [ ] Potions can be used from bag with validation
- [ ] Bertymon can be switched (when multiple in party)
- [ ] Battle end conditions (victory/defeat) work correctly
- [ ] Player is returned to intro after battle
- [ ] HP is restored on defeat
- [ ] No console errors or crashes during gameplay

---

## Known Limitations

1. **Single Bertymon per Side**: Current implementation supports only 1 Bertymon per side
   - Party UI is built for multiple but not fully tested
   - To test multiple Bertymon: Manually add more to `gameState.playerParty` in developer console

2. **Limited Move Pool**: Only 6 moves defined
   - Can be expanded by adding to `MOVES` constant

3. **No Move PP (Power Points)**: Moves can be used infinitely
   - Could be added as a future enhancement

4. **No Level System**: All Bertymon start at same stats
   - Could be added for progression

5. **No Ability System**: Abilities not implemented
   - Could be added as an enhancement

---

## Reporting Issues

If you encounter:

- **Crash or freeze**: Check browser console for error messages
- **Incorrect damage**: Verify type effectiveness and stat stage calculations
- **Button not responding**: Ensure battle phase is "action"
- **Sprite not visible**: Verify sprite files exist in `/sprites/` directory
- **Wrong rival pick**: Check `getRivalStarter()` logic for type counter-picks

