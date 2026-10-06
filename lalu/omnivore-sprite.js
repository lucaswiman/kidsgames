// Omnivore sprite that eats both fruit and foxes; each one is either blue or green
class OmnivoreSprite extends AnimalSprite {
  constructor(id, x, y, getVisibleSprites, mother = null, father = null) {
    super(id, 'omnivore', x, y, getVisibleSprites, mother);
    this.hungerLevel = 0; // Goes up each day; eating brings it back down
    // Babies get their color from one of their parents
    const parent = mother && father ? (Math.random() < 0.5 ? mother : father) : null;
    this.color = parent ? parent.color : Math.random() < 0.5 ? 'blue' : 'green';
  }

  static SIGHT_RANGE = 250; // How far away (px) it can spot a fox
  static STARVE_LEVEL = 3; // Hunger level at which it starves

  getLifespan() {
    return 20;
  }

  // Like healthy lalus, only full omnivores breed
  isReadyToBreed() {
    return this.hungerLevel === 0;
  }

  computeClassNames() {
    const classes = ['sprite', 'omnivore'];
    if (this.state !== 'alive') {
      classes.push(this.state);
    }
    return classes;
  }

  getTitle() {
    if (this.state === 'dead') {
      return `Omnivore (${this.color}, ${this.gender}, dead)`;
    }
    if (this.isBaby()) {
      return `Baby omnivore (${this.color}, ${this.gender}, ${this.babyAge} days)`;
    }
    const hunger = this.hungerLevel === 0 ? 'full' : `hungry ${this.hungerLevel}`;
    return `Omnivore (${this.color}, ${this.gender}, age ${this.age}/${this.getLifespan()}, ${hunger}/${OmnivoreSprite.STARVE_LEVEL})`;
  }

  getWidth() {
    return this.isBaby() ? 25 : 50;
  }

  getHeight() {
    return this.isBaby() ? 25 : 50;
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

  isHungry() {
    return this.isAlive() && !this.isBaby() && this.hungerLevel > 0;
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
    if (this.isBaby()) {
      return this.getMotherPosition();
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

    // Full omnivores seek the nearest available mate
    const nearestMate = this.findNearestMate();
    if (nearestMate) {
      this.wanderTarget = null;
      return { x: nearestMate.getCenterX(), y: nearestMate.getCenterY() };
    }

    return this.getWanderTarget();
  }

  onCollision(otherSprite) {
    if (this.breedWith(otherSprite)) {
      return true;
    }

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
    if (!this.ageOneDay()) {
      return;
    }
    this.hungerLevel++;
    if (this.hungerLevel >= OmnivoreSprite.STARVE_LEVEL) {
      this.die();
    }
  }
}
