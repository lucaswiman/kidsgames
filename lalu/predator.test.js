const fs = require('fs');
const path = require('path');
const vm = require('vm');

// The lalu game uses plain browser scripts, so load them into a shared VM context
function loadGame() {
  const context = vm.createContext({ window: { innerWidth: 1000, innerHeight: 800 }, Math });
  ['base-sprite.js', 'nest-sprite.js', 'lalu-sprite.js', 'predator-sprite.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  });
  const sprites = [];
  const getVisibleSprites = sprite => sprites.filter(s => s !== sprite);
  const { NestSprite, LaluSprite, PredatorSprite } = vm.runInContext(
    '({ NestSprite, LaluSprite, PredatorSprite })',
    context
  );
  context.window.game = { sprites, dragState: { isDragging: false, dragSprite: null } };
  return { context, sprites, getVisibleSprites, NestSprite, LaluSprite, PredatorSprite };
}

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
