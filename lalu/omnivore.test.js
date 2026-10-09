const { loadGame } = require('./load-game');

describe('OmnivoreSprite', () => {
  let game;
  let omnivore;
  let fox;
  let tree;

  beforeEach(() => {
    game = loadGame();
    omnivore = new game.OmnivoreSprite('omni_1', 100, 100, game.getVisibleSprites);
    fox = new game.PredatorSprite('fox_1', 200, 100, game.getVisibleSprites);
    tree = new game.TreeSprite('tree_1', 600, 500, game.getVisibleSprites);
    tree.fruitCount = 2;
    game.sprites.push(omnivore, fox, tree);
  });

  const target = sprite => ({ x: sprite.getCenterX(), y: sprite.getCenterY() });

  test('is either blue or green, with a matching picture', () => {
    expect(['blue', 'green']).toContain(omnivore.color);
    expect(omnivore.getBackgroundImage()).toBe(`url("omnivore-${omnivore.color}.png")`);
  });

  test('wanders instead of hunting when full', () => {
    expect(omnivore.getTargetPosition()).not.toEqual(target(fox));
    expect(omnivore.onCollision(fox)).toBe(false);
    expect(omnivore.onCollision(tree)).toBe(false);
    expect(tree.fruitCount).toBe(2);
  });

  test('when hungry, heads for the nearest food', () => {
    omnivore.hungerLevel = 1;
    expect(omnivore.getTargetPosition()).toEqual(target(fox));
    fox.updatePosition(900, 700);
    expect(omnivore.getTargetPosition()).toEqual(target(tree));
  });

  test('ignores foxes beyond its sight range but sees fruit trees anywhere', () => {
    omnivore.hungerLevel = 1;
    game.sprites.splice(game.sprites.indexOf(tree), 1);
    fox.updatePosition(900, 700);
    expect(omnivore.getTargetPosition()).not.toEqual(target(fox));
  });

  test('each fruit takes one level off its hunger', () => {
    omnivore.hungerLevel = 1;
    expect(omnivore.onCollision(tree)).toBe(true);
    expect(omnivore.hungerLevel).toBe(0);
    expect(tree.fruitCount).toBe(1);
  });

  test('eats only as much fruit as it needs', () => {
    omnivore.hungerLevel = 2;
    tree.fruitCount = 1;
    omnivore.onCollision(tree);
    expect(omnivore.hungerLevel).toBe(1);
    expect(tree.fruitCount).toBe(0);
    expect(omnivore.canEat(tree)).toBe(false);
  });

  test('eating a fox fills it up completely and kills the fox and its cubs', () => {
    omnivore.hungerLevel = 2;
    fox.gender = 'female';
    const father = new game.PredatorSprite('fox_2', 210, 100, game.getVisibleSprites);
    father.gender = 'male';
    fox.breedWith(father);
    const cub = game.sprites.find(s => s.state === 'baby');
    expect(omnivore.onCollision(fox)).toBe(true);
    expect(omnivore.hungerLevel).toBe(0);
    expect(fox.eaten).toBe(true);
    expect(fox.isAlive()).toBe(false);
    expect(cub.isAlive()).toBe(false);
  });

  test('can eat sleeping foxes and cubs', () => {
    omnivore.hungerLevel = 1;
    fox.state = 'sleeping';
    expect(omnivore.canEat(fox)).toBe(true);
    fox.state = 'baby';
    expect(omnivore.canEat(fox)).toBe(true);
    fox.state = 'dead';
    expect(omnivore.canEat(fox)).toBe(false);
  });

  test('starves when hunger reaches STARVE_LEVEL', () => {
    for (let day = 1; day < game.OmnivoreSprite.STARVE_LEVEL; day++) {
      omnivore.onDayEnd();
      expect(omnivore.isAlive()).toBe(true);
    }
    omnivore.onDayEnd();
    expect(omnivore.isAlive()).toBe(false);
    expect(omnivore.getTargetPosition()).toBeNull();
  });
});

describe('OmnivoreSprite breeding', () => {
  let game;
  let male;
  let female;

  beforeEach(() => {
    game = loadGame();
    male = new game.OmnivoreSprite('omni_m', 100, 100, game.getVisibleSprites);
    female = new game.OmnivoreSprite('omni_f', 300, 100, game.getVisibleSprites);
    male.gender = 'male';
    female.gender = 'female';
    game.sprites.push(male, female);
  });

  const babies = () => game.sprites.filter(s => s.type === 'omnivore' && s.isBaby());

  test('full omnivores of opposite genders seek each other out', () => {
    expect(male.getTargetPosition()).toEqual({ x: female.getCenterX(), y: female.getCenterY() });
  });

  test('mating produces a small baby that follows its mother', () => {
    expect(male.onCollision(female)).toBe(true);
    expect(babies()).toHaveLength(1);
    const baby = babies()[0];
    expect(baby.mother).toBe(female);
    expect(baby.getWidth()).toBeLessThan(female.getWidth());
    expect(baby.getTargetPosition()).toEqual({ x: female.getCenterX(), y: female.getCenterY() });
  });

  test('babies get their color from one of their parents', () => {
    male.color = 'blue';
    female.color = 'blue';
    male.onCollision(female);
    expect(babies()[0].color).toBe('blue');

    const colors = new Set();
    for (let i = 0; i < 40; i++) {
      const baby = new game.OmnivoreSprite(`b${i}`, 0, 0, game.getVisibleSprites, female, {
        color: 'green',
      });
      colors.add(baby.color);
    }
    expect(colors).toEqual(new Set(['blue', 'green']));
  });

  test('hungry omnivores cannot breed', () => {
    male.hungerLevel = 1;
    expect(male.onCollision(female)).toBe(false);
    expect(babies()).toHaveLength(0);
  });

  test('omnivores breed at most once per day, and not while they have a baby', () => {
    male.onCollision(female);
    male.hasReproduced = false;
    female.hasReproduced = false;
    expect(female.canReproduce()).toBe(false);
    expect(male.onCollision(female)).toBe(false);
  });

  test('babies do not get hungry or eat, and grow up after BABY_DAYS days', () => {
    male.onCollision(female);
    const baby = babies()[0];
    const tree = new game.TreeSprite('tree_1', 100, 100, game.getVisibleSprites);
    tree.fruitCount = 2;
    expect(baby.onCollision(tree)).toBe(false);
    for (let day = 1; day < game.AnimalSprite.BABY_DAYS; day++) {
      baby.onDayEnd();
      expect(baby.isBaby()).toBe(true);
      expect(baby.hungerLevel).toBe(0);
    }
    baby.onDayEnd();
    expect(baby.state).toBe('alive');
    expect(baby.mother).toBeNull();
  });

  test('a baby dies if its mother starves', () => {
    male.onCollision(female);
    const baby = babies()[0];
    for (let day = 0; day < game.OmnivoreSprite.STARVE_LEVEL; day++) {
      female.onDayEnd();
    }
    expect(female.isAlive()).toBe(false);
    expect(baby.isAlive()).toBe(false);
  });
});

describe('lifespans', () => {
  let game;

  beforeEach(() => {
    game = loadGame();
  });

  // Keeps an animal fed so only old age can kill it
  function liveDays(animal, days) {
    for (let day = 0; day < days; day++) {
      animal.daysWithoutFood = 0;
      animal.hungerLevel = 0;
      animal.onDayEnd();
    }
  }

  test('foxes die of old age after 50 days', () => {
    const fox = new game.PredatorSprite('fox_1', 0, 0, game.getVisibleSprites);
    liveDays(fox, 49);
    expect(fox.isAlive()).toBe(true);
    liveDays(fox, 1);
    expect(fox.isAlive()).toBe(false);
  });

  test('foxes keep aging while asleep', () => {
    const fox = new game.PredatorSprite('fox_1', 0, 0, game.getVisibleSprites);
    fox.state = 'sleeping';
    fox.sleepDaysLeft = 2;
    fox.onDayEnd();
    expect(fox.age).toBe(1);
  });

  test('omnivores die of old age after 20 days', () => {
    const omnivore = new game.OmnivoreSprite('omni_1', 0, 0, game.getVisibleSprites);
    liveDays(omnivore, 19);
    expect(omnivore.isAlive()).toBe(true);
    liveDays(omnivore, 1);
    expect(omnivore.isAlive()).toBe(false);
  });

  test('days as a baby do not count toward lifespan', () => {
    const mother = new game.OmnivoreSprite('omni_m', 0, 0, game.getVisibleSprites);
    const baby = new game.OmnivoreSprite('omni_b', 0, 0, game.getVisibleSprites, mother, mother);
    liveDays(baby, game.AnimalSprite.BABY_DAYS);
    expect(baby.isBaby()).toBe(false);
    expect(baby.age).toBe(0);
  });
});
