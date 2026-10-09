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
  const target = sprite => ({ x: sprite.getCenterX(), y: sprite.getCenterY() });

  function addMale(id, x, earSize) {
    const lalu = new game.LaluSprite(id, x, 100, game.getVisibleSprites, null);
    lalu.gender = 'male';
    lalu.earSize = earSize;
    game.sprites.push(lalu);
    return lalu;
  }

  test('every lalu has small, normal or big ears', () => {
    expect([-1, 0, 1]).toContain(male.earSize);
  });

  test('with only one male ready, she chooses him whatever his ears', () => {
    male.earSize = -1;
    expect(female.choosesMate(male)).toBe(true);
    expect(male.onCollision(female)).toBe(true);
    expect(babies()).toHaveLength(1);
  });

  test('females head for the male with the biggest ears, even if he is farther away', () => {
    male.earSize = 0;
    const bigEared = addMale('lalu_m2', 600, 1);
    expect(female.getTargetPosition()).toEqual(target(bigEared));
  });

  test('a smaller-eared male who bumps into her does not get to mate', () => {
    male.earSize = -1;
    addMale('lalu_m2', 600, 1);
    expect(female.choosesMate(male)).toBe(false);
    expect(male.onCollision(female)).toBe(false);
    expect(female.onCollision(male)).toBe(false);
    expect(babies()).toHaveLength(0);
  });

  test('males that would not be chosen do not chase her', () => {
    male.earSize = -1;
    female.updatePosition(500, 100);
    addMale('lalu_m2', 600, 1);
    expect(male.getTargetPosition()).not.toEqual(target(female));
  });

  test('males that are not ready do not count', () => {
    male.earSize = -1;
    const bigEared = addMale('lalu_m2', 600, 1);
    bigEared.hasReproduced = true;
    expect(female.choosesMate(male)).toBe(true);
    bigEared.hasReproduced = false;
    bigEared.state = 'hungry';
    expect(female.choosesMate(male)).toBe(true);
  });

  test('males with equally big ears are both acceptable; she goes to the nearer one', () => {
    male.earSize = 1;
    const far = addMale('lalu_m2', 600, 1);
    expect(female.choosesMate(far)).toBe(true);
    expect(female.getTargetPosition()).toEqual(target(male));
  });

  test('babies inherit ear size from one of their parents', () => {
    male.earSize = 1;
    female.earSize = 1;
    // Picks a parent and skips mutation
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    male.onCollision(female);
    expect(babies()[0].earSize).toBe(1);
  });
});
