const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCRIPTS = [
  'base-sprite.js',
  'tree-sprite.js',
  'nest-sprite.js',
  'lalu-sprite.js',
  'animal-sprite.js',
  'predator-sprite.js',
  'omnivore-sprite.js',
];

// The lalu game uses plain browser scripts, so tests load them into a shared VM context
function loadGame() {
  const context = vm.createContext({ window: { innerWidth: 1000, innerHeight: 800 }, Math });
  SCRIPTS.forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  });
  const sprites = [];
  const getVisibleSprites = sprite => sprites.filter(s => s !== sprite);
  const classes = vm.runInContext(
    '({ TreeSprite, NestSprite, LaluSprite, AnimalSprite, PredatorSprite, OmnivoreSprite })',
    context
  );
  context.window.game = { sprites, dragState: { isDragging: false, dragSprite: null } };
  return { context, sprites, getVisibleSprites, ...classes };
}

module.exports = { loadGame };
