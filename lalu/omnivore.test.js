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
    fox.createCub(fox);
    const cub = game.sprites.find(s => s.state === 'cub');
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
    fox.state = 'cub';
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
