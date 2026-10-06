// Omnivore sprite that eats both fruit and foxes; each one is either blue or green
class OmnivoreSprite extends Sprite {
  constructor(id, x, y, getVisibleSprites) {
    super(id, 'omnivore', x, y, getVisibleSprites);
    this.state = 'alive';
    this.hungerLevel = 0; // Goes up each day; eating brings it back down
    this.color = Math.random() < 0.5 ? 'blue' : 'green';
  }

  static SIGHT_RANGE = 250; // How far away (px) it can spot a fox
  static STARVE_LEVEL = 3; // Hunger level at which it starves

  computeClassNames() {
    const classes = ['sprite', 'omnivore'];
    if (this.state === 'dead') {
      classes.push('dead');
    }
    return classes;
  }

  getTitle() {
    if (this.state === 'dead') {
      return `Omnivore (${this.color}, dead)`;
    }
    const hunger = this.hungerLevel === 0 ? 'full' : `hungry ${this.hungerLevel}`;
    return `Omnivore (${this.color}, ${hunger}/${OmnivoreSprite.STARVE_LEVEL})`;
  }

  getWidth() {
    return 50;
  }

  getHeight() {
    return 50;
  }

  getBackgroundImage() {
    return `url("omnivore-${this.color}.png")`;
  }

  getStyle() {
    const style = {
      backgroundColor: 'transparent',
      borderRadius: '0',
    };

    // Hungry omnivores glow orange, then red when about to starve
    if (this.state === 'dead') {
      style.opacity = '0.5';
      style.filter = 'grayscale(100%)';
    } else if (this.hungerLevel >= OmnivoreSprite.STARVE_LEVEL - 1) {
      style.filter = 'drop-shadow(0 0 6px #FF0000)';
    } else if (this.hungerLevel > 0) {
      style.filter = 'drop-shadow(0 0 6px #FFA500)';
    }

    return style;
  }

  isAlive() {
    return this.state !== 'dead';
  }

  isHungry() {
    return this.isAlive() && this.hungerLevel > 0;
  }

  getMaxVelocity() {
    return 3.5;
  }

  canEat(sprite) {
    if (sprite.type === 'tree') {
      return sprite.fruitCount > 0;
    }
    return sprite.type === 'predator' && sprite.isAlive();
  }

  getTargetPosition() {
    if (!this.isAlive()) {
      return null;
    }

    // Hungry omnivores head for the nearest food: any tree with fruit, or a fox in sight
    if (this.isHungry()) {
      const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
      const nearestTree = this.findNearest(
        visibleSprites.filter(s => s.type === 'tree' && this.canEat(s))
      );
      const nearestFox = this.findNearest(
        visibleSprites.filter(s => s.type === 'predator' && this.canEat(s)),
        OmnivoreSprite.SIGHT_RANGE
      );
      const food = this.findNearest([nearestTree, nearestFox].filter(Boolean));
      if (food) {
        this.wanderTarget = null;
        return { x: food.getCenterX(), y: food.getCenterY() };
      }
    }

    return this.getWanderTarget();
  }

  onCollision(otherSprite) {
    if (!this.isHungry() || !this.canEat(otherSprite)) {
      return false;
    }

    if (otherSprite.type === 'tree') {
      // Each fruit takes one level off its hunger
      while (this.hungerLevel > 0 && otherSprite.harvestFruit()) {
        this.hungerLevel--;
      }
      return true;
    }

    // A fox is a full meal; the game board removes eaten sprites
    otherSprite.state = 'dead';
    otherSprite.eaten = true;
    otherSprite.handleDeath();
    this.hungerLevel = 0;
    return true;
  }

  onDayEnd() {
    if (this.isAlive()) {
      this.hungerLevel++;
      if (this.hungerLevel >= OmnivoreSprite.STARVE_LEVEL) {
        this.state = 'dead';
      }
    }
  }
}
