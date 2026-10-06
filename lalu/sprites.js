// Factory function to create sprites
function createSprite(type, x, y, getVisibleSprites, nest = null) {
  const id = `${type}_${Math.random().toString(36).substr(2, 9)}`;

  switch (type) {
    case 'nest':
      return new NestSprite(id, x, y, getVisibleSprites);
    case 'tree':
      return new TreeSprite(id, x, y, getVisibleSprites);
    case 'predator':
      return new PredatorSprite(id, x, y, getVisibleSprites);
    case 'omnivore':
      return new OmnivoreSprite(id, x, y, getVisibleSprites);
    case 'lalu':
      return new LaluSprite(id, x, y, getVisibleSprites, nest);
    default:
      throw new Error(`Unknown sprite type: ${type}`);
  }
}
