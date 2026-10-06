const { loadGame } = require('./load-game');

describe('LaluSprite ear size and mate choice', () => {
  let game;
  let male;
  let female;

  beforeEach(() => {
    game = loadGame();
    male = new game.LaluSprite('lalu_m', 100, 100, game.getVisibleSprites, null);
    female = new game.LaluSprite('lalu_f', 130, 100, game.getVisibleSprites, null);
    male.gender = 'male';
    female.gender = 'female';
    game.sprites.push(male, female);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const babies = () => game.sprites.filter(s => s.state === 'baby');

  test('every lalu has small, normal or big ears', () => {
    expect([-1, 0, 1]).toContain(male.earSize);
  });

  test('bigger ears make a female more likely to accept', () => {
    const chance = game.LaluSprite.mateAcceptChance;
    expect(chance(-1)).toBeLessThan(chance(0));
    expect(chance(0)).toBeLessThan(chance(1));
  });

  test('a female accepts a male when the roll is under his chance', () => {
    male.earSize = 1;
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(male.onCollision(female)).toBe(true);
    expect(babies()).toHaveLength(1);
  });

  test('a female can turn a male down, and he cannot try again that day', () => {
    male.earSize = -1;
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(male.onCollision(female)).toBe(false);
    expect(babies()).toHaveLength(0);
    expect(female.hasRejected(male)).toBe(true);
    expect(male.hasRejected(female)).toBe(true);

    // Even a lucky roll doesn't help him for the rest of the day
    Math.random.mockReturnValue(0);
    expect(male.onCollision(female)).toBe(false);
    expect(female.onCollision(male)).toBe(false);
  });

  test('rejections are forgotten at the end of the day', () => {
    male.earSize = -1;
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    male.onCollision(female);
    Math.random.mockRestore();
    female.increaseHunger();
    expect(female.hasRejected(male)).toBe(false);
  });

  test('a rejected male stops chasing that female', () => {
    female.updatePosition(500, 100);
    expect(male.getTargetPosition()).toEqual({ x: female.getCenterX(), y: female.getCenterY() });
    female.rejectedMates.add(male);
    expect(male.getTargetPosition()).not.toEqual({
      x: female.getCenterX(),
      y: female.getCenterY(),
    });
  });

  test('females head for the male with the biggest ears, even if he is farther away', () => {
    male.earSize = 0;
    const bigEared = new game.LaluSprite('lalu_m2', 600, 100, game.getVisibleSprites, null);
    bigEared.gender = 'male';
    bigEared.earSize = 1;
    game.sprites.push(bigEared);
    expect(female.getTargetPosition()).toEqual({
      x: bigEared.getCenterX(),
      y: bigEared.getCenterY(),
    });
  });

  test('babies inherit ear size from one of their parents', () => {
    male.earSize = 1;
    female.earSize = 1;
    game.context.window.game.sprites = game.sprites;
    // First roll accepts the mate; the rest pick parents and skip mutation
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    male.onCollision(female);
    expect(babies()[0].earSize).toBe(1);
  });
});
