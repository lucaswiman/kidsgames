// Predator sprite (a fox) that hunts lalus outside their nests
class PredatorSprite extends Sprite {
  constructor(id, x, y, getVisibleSprites) {
    super(id, 'predator', x, y, getVisibleSprites);
    this.state = 'hunting';
    this.sleepDaysLeft = 0;
    this.wanderTarget = null;
  }

  static SIGHT_RANGE = 250; // How far away (px) the fox can spot a lalu
  static SLEEP_DAYS = 2; // Days the fox sleeps after eating

  computeClassNames() {
    const classes = ['sprite', 'predator'];
    if (this.state === 'sleeping') {
      classes.push('sleeping');
    }
    return classes;
  }

  getTitle() {
    if (this.state === 'sleeping') {
      return `Fox (sleeping, ${this.sleepDaysLeft} days left)`;
    }
    return 'Fox (hunting)';
  }

  getWidth() {
    return 60;
  }

  getHeight() {
    return 60;
  }

  getLabel() {
    return '🦊';
  }

  getStyle() {
    return {
      backgroundColor: 'transparent',
      borderRadius: '0',
    };
  }

  // Slower than lalus, so a lalu heading away can outrun it
  getMaxVelocity() {
    return 3;
  }

  distanceTo(sprite) {
    return Math.sqrt(
      Math.pow(this.getCenterX() - sprite.getCenterX(), 2) +
        Math.pow(this.getCenterY() - sprite.getCenterY(), 2)
    );
  }

  canCatch(sprite) {
    if (sprite.type !== 'lalu' || !sprite.isAlive() || sprite.isSafeInNest()) {
      return false;
    }
    // A lalu held by the player is safe
    const dragState = window.game && window.game.dragState;
    return !(dragState && dragState.isDragging && dragState.dragSprite === sprite);
  }

  getTargetPosition() {
    if (this.state === 'sleeping') {
      return null;
    }

    // Chase the nearest catchable lalu in sight
    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
    let nearestPrey = null;
    let minDistance = PredatorSprite.SIGHT_RANGE;
    visibleSprites.forEach(sprite => {
      if (this.canCatch(sprite)) {
        const distance = this.distanceTo(sprite);
        if (distance < minDistance) {
          minDistance = distance;
          nearestPrey = sprite;
        }
      }
    });

    if (nearestPrey) {
      this.wanderTarget = null;
      return { x: nearestPrey.getCenterX(), y: nearestPrey.getCenterY() };
    }

    // Otherwise wander to random spots the fox's center can actually reach
    const reachedWanderTarget =
      this.wanderTarget &&
      Math.hypot(
        this.wanderTarget.x - this.getCenterX(),
        this.wanderTarget.y - this.getCenterY()
      ) <= 5;
    if (!this.wanderTarget || reachedWanderTarget) {
      this.wanderTarget = {
        x: this.getWidth() / 2 + Math.random() * (window.innerWidth - this.getWidth()),
        y: this.getHeight() / 2 + Math.random() * (window.innerHeight - this.getHeight()),
      };
    }
    return this.wanderTarget;
  }

  onCollision(otherSprite) {
    if (this.state !== 'hunting' || !this.canCatch(otherSprite)) {
      return false;
    }

    // Eat the lalu; the game board removes eaten sprites
    otherSprite.state = 'dead';
    otherSprite.eaten = true;
    otherSprite.handleDeath();

    this.state = 'sleeping';
    this.sleepDaysLeft = PredatorSprite.SLEEP_DAYS;
    return true;
  }

  onDayEnd() {
    if (this.state === 'sleeping') {
      this.sleepDaysLeft--;
      if (this.sleepDaysLeft <= 0) {
        this.state = 'hunting';
      }
    }
  }
}
