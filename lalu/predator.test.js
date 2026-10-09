const { loadGame } = require('./load-game');

describe('PredatorSprite', () => {
  let game;
  let fox;
  let lalu;

  beforeEach(() => {
    game = loadGame();
    const nest = new game.NestSprite('nest_1', 800, 600, game.getVisibleSprites);
    fox = new game.PredatorSprite('fox_1', 100, 100, game.getVisibleSprites);
    lalu = new game.LaluSprite('lalu_1', 200, 100, game.getVisibleSprites, nest);
    lalu.inNest = false;
    game.sprites.push(nest, fox, lalu);
  });

  test('chases a lalu that is out of its nest and in sight', () => {
    expect(fox.getTargetPosition()).toEqual({ x: lalu.getCenterX(), y: lalu.getCenterY() });
  });

  test('ignores lalus that are safe in their nest', () => {
    lalu.inNest = true;
    expect(fox.canCatch(lalu)).toBe(false);
    expect(fox.getTargetPosition()).not.toEqual({ x: lalu.getCenterX(), y: lalu.getCenterY() });
  });

  test('ignores lalus beyond its sight range', () => {
    lalu.updatePosition(900, 700);
    expect(fox.getTargetPosition()).not.toEqual({ x: lalu.getCenterX(), y: lalu.getCenterY() });
  });

  test('cannot catch a lalu the player is dragging', () => {
    game.context.window.game.dragState = { isDragging: true, dragSprite: lalu };
    expect(fox.onCollision(lalu)).toBe(false);
    expect(lalu.isAlive()).toBe(true);
  });

  test('eats a lalu on collision, removes its nest, then sleeps', () => {
    expect(fox.onCollision(lalu)).toBe(true);
    expect(lalu.eaten).toBe(true);
    expect(lalu.isAlive()).toBe(false);
    expect(game.sprites.some(s => s.type === 'nest')).toBe(false);
    expect(fox.state).toBe('sleeping');
    expect(fox.getTargetPosition()).toBeNull();
  });

  test('wakes up after sleeping for SLEEP_DAYS days', () => {
    fox.onCollision(lalu);
    for (let day = 1; day < game.PredatorSprite.SLEEP_DAYS; day++) {
      fox.onDayEnd();
      expect(fox.state).toBe('sleeping');
    }
    fox.onDayEnd();
    expect(fox.state).toBe('hunting');
  });

  test('starves after STARVE_DAYS awake days without eating', () => {
    for (let day = 1; day < game.PredatorSprite.STARVE_DAYS; day++) {
      fox.onDayEnd();
      expect(fox.isAlive()).toBe(true);
    }
    fox.onDayEnd();
    expect(fox.state).toBe('dead');
    expect(fox.getTargetPosition()).toBeNull();
    expect(fox.onCollision(lalu)).toBe(false);
    expect(lalu.isAlive()).toBe(true);
  });

  test('eating resets hunger', () => {
    fox.onDayEnd();
    fox.onDayEnd();
    fox.onCollision(lalu);
    expect(fox.daysWithoutFood).toBe(0);
  });

  test('hunger does not grow while sleeping', () => {
    fox.onCollision(lalu);
    for (let day = 0; day < game.PredatorSprite.SLEEP_DAYS; day++) {
      fox.onDayEnd();
    }
    expect(fox.state).toBe('hunting');
    expect(fox.daysWithoutFood).toBe(0);
    // After waking, it still gets the full STARVE_DAYS to find food
    for (let day = 1; day < game.PredatorSprite.STARVE_DAYS; day++) {
      fox.onDayEnd();
    }
    expect(fox.isAlive()).toBe(true);
  });

  test('does not eat while sleeping', () => {
    fox.state = 'sleeping';
    expect(fox.onCollision(lalu)).toBe(false);
    expect(lalu.isAlive()).toBe(true);
  });

  test('babies are only catchable when their mother has left the nest', () => {
    const baby = new game.LaluSprite('lalu_2', 210, 100, game.getVisibleSprites, lalu.nest, lalu);
    lalu.inNest = true;
    expect(fox.canCatch(baby)).toBe(false);
    lalu.inNest = false;
    expect(fox.canCatch(baby)).toBe(true);
  });

  test('wander targets stay within reach of the fox center', () => {
    lalu.inNest = true;
    for (let i = 0; i < 50; i++) {
      fox.wanderTarget = null;
      const target = fox.getTargetPosition();
      expect(target.x).toBeGreaterThanOrEqual(fox.getWidth() / 2);
      expect(target.x).toBeLessThanOrEqual(1000 - fox.getWidth() / 2);
      expect(target.y).toBeGreaterThanOrEqual(fox.getHeight() / 2);
      expect(target.y).toBeLessThanOrEqual(800 - fox.getHeight() / 2);
    }
  });
});

describe('PredatorSprite breeding', () => {
  let game;
  let male;
  let female;

  beforeEach(() => {
    game = loadGame();
    male = new game.PredatorSprite('fox_m', 100, 100, game.getVisibleSprites);
    female = new game.PredatorSprite('fox_f', 300, 100, game.getVisibleSprites);
    male.gender = 'male';
    female.gender = 'female';
    game.sprites.push(male, female);
  });

  const cubs = () => game.sprites.filter(s => s.state === 'baby');

  test('well-fed foxes of opposite genders seek each other out', () => {
    expect(male.getTargetPosition()).toEqual({ x: female.getCenterX(), y: female.getCenterY() });
  });

  test('foxes of the same gender do not mate', () => {
    female.gender = 'male';
    expect(male.onCollision(female)).toBe(false);
    expect(cubs()).toHaveLength(0);
  });

  test('mating produces a cub that follows its mother', () => {
    expect(male.onCollision(female)).toBe(true);
    expect(cubs()).toHaveLength(1);
    const cub = cubs()[0];
    expect(cub.mother).toBe(female);
    expect(cub.getWidth()).toBeLessThan(female.getWidth());
    expect(cub.getTargetPosition()).toEqual({ x: female.getCenterX(), y: female.getCenterY() });
  });

  test('sleeping foxes cannot breed', () => {
    female.state = 'sleeping';
    expect(male.canMateWith(female)).toBe(false);
    expect(female.canMateWith(male)).toBe(false);
    expect(male.onCollision(female)).toBe(false);
    expect(cubs()).toHaveLength(0);
  });

  test('hungry foxes cannot breed', () => {
    male.daysWithoutFood = 1;
    expect(male.onCollision(female)).toBe(false);
  });

  test('foxes breed at most once per day', () => {
    male.onCollision(female);
    const otherFemale = new game.PredatorSprite('fox_f2', 120, 100, game.getVisibleSprites);
    otherFemale.gender = 'female';
    game.sprites.push(otherFemale);
    expect(male.onCollision(otherFemale)).toBe(false);
    expect(cubs()).toHaveLength(1);
  });

  test('a mother cannot breed again while she has a cub', () => {
    male.onCollision(female);
    male.hasReproduced = false;
    female.hasReproduced = false;
    expect(female.canReproduce()).toBe(false);
  });

  test('cubs do not get hungry and grow up after BABY_DAYS days', () => {
    male.onCollision(female);
    const cub = cubs()[0];
    for (let day = 1; day < game.AnimalSprite.BABY_DAYS; day++) {
      cub.onDayEnd();
      expect(cub.state).toBe('baby');
      expect(cub.daysWithoutFood).toBe(0);
    }
    cub.onDayEnd();
    expect(cub.state).toBe('hunting');
    expect(cub.mother).toBeNull();
  });

  test('a cub dies if its mother starves', () => {
    male.onCollision(female);
    const cub = cubs()[0];
    for (let day = 0; day < game.PredatorSprite.STARVE_DAYS; day++) {
      female.onDayEnd();
    }
    expect(female.isAlive()).toBe(false);
    expect(cub.isAlive()).toBe(false);
  });

  test('cubs do not hunt lalus', () => {
    male.onCollision(female);
    const cub = cubs()[0];
    const lalu = new game.LaluSprite('lalu_1', 100, 100, game.getVisibleSprites, null);
    lalu.inNest = false;
    expect(cub.onCollision(lalu)).toBe(false);
    expect(lalu.isAlive()).toBe(true);
  });
});
