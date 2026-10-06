// Predator sprite (a fox) that hunts lalus outside their nests
// Fox state machine: baby -> hunting <-> sleeping, and hunting -> dead when starved or old
class PredatorSprite extends AnimalSprite {
  constructor(id, x, y, getVisibleSprites, mother = null) {
    super(id, 'predator', x, y, getVisibleSprites, mother);
    this.sleepDaysLeft = 0;
    this.daysWithoutFood = 0; // Only counts days spent awake
  }

  static SIGHT_RANGE = 250; // How far away (px) the fox can spot a lalu
  static SLEEP_DAYS = 2; // Days the fox sleeps after eating
  static STARVE_DAYS = 3; // Awake days without eating before the fox starves

  getAdultState() {
    return 'hunting';
  }

  // Like healthy lalus, only well-fed, awake foxes breed
  isReadyToBreed() {
    return this.state === 'hunting' && this.daysWithoutFood === 0;
  }

  computeClassNames() {
    const classes = ['sprite', 'predator'];
    if (this.state !== 'hunting') {
      classes.push(this.state);
    }
    return classes;
  }

  getTitle() {
    if (this.state === 'dead') {
      return `Fox (dead, ${this.gender})`;
    }
    if (this.isBaby()) {
      return `Fox cub (${this.gender}, ${this.babyAge} days)`;
    }
    const age = `age ${this.age}/${this.getLifespan()}`;
    if (this.state === 'sleeping') {
      return `Fox (sleeping, ${this.gender}, ${age}, ${this.sleepDaysLeft} days left)`;
    }
    return `Fox (hunting, ${this.gender}, ${age}, ${this.daysWithoutFood}/${PredatorSprite.STARVE_DAYS} days without food)`;
  }

  getWidth() {
    return this.isBaby() ? 30 : 60;
  }

  getHeight() {
    return this.isBaby() ? 30 : 60;
  }

  getBackgroundImage() {
    return 'url("fox-transparent.png")';
  }

  getStyle() {
    const style = {
      backgroundColor: 'transparent',
      borderRadius: '0',
    };

    // Hungry foxes glow orange, then red when about to starve
    if (this.state === 'dead') {
      style.opacity = '0.5';
      style.filter = 'grayscale(100%)';
    } else if (this.daysWithoutFood >= PredatorSprite.STARVE_DAYS - 1) {
      style.filter = 'drop-shadow(0 0 6px #FF0000)';
    } else if (this.daysWithoutFood > 0) {
      style.filter = 'drop-shadow(0 0 6px #FFA500)';
    }

    return style;
  }

  // Slower than lalus, so a lalu heading away can outrun it
  getMaxVelocity() {
    return 3;
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
    if (this.isBaby()) {
      return this.getMotherPosition();
    }
    if (this.state !== 'hunting') {
      return null;
    }

    // Well-fed foxes seek the nearest available mate
    const nearestMate = this.findNearestMate();
    if (nearestMate) {
      this.wanderTarget = null;
      return { x: nearestMate.getCenterX(), y: nearestMate.getCenterY() };
    }

    // Otherwise chase the nearest catchable lalu in sight
    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
    const nearestPrey = this.findNearest(
      visibleSprites.filter(s => this.canCatch(s)),
      PredatorSprite.SIGHT_RANGE
    );
    if (nearestPrey) {
      this.wanderTarget = null;
      return { x: nearestPrey.getCenterX(), y: nearestPrey.getCenterY() };
    }

    return this.getWanderTarget();
  }

  onCollision(otherSprite) {
    if (this.breedWith(otherSprite)) {
      return true;
    }

    if (this.state !== 'hunting' || !this.canCatch(otherSprite)) {
      return false;
    }

    // Eat the lalu; the game board removes eaten sprites
    otherSprite.state = 'dead';
    otherSprite.eaten = true;
    otherSprite.handleDeath();

    this.state = 'sleeping';
    this.sleepDaysLeft = PredatorSprite.SLEEP_DAYS;
    this.daysWithoutFood = 0;
    return true;
  }

  onDayEnd() {
    if (!this.ageOneDay()) {
      return;
    }
    if (this.state === 'sleeping') {
      // Sleeping foxes don't get hungrier
      this.sleepDaysLeft--;
      if (this.sleepDaysLeft <= 0) {
        this.state = 'hunting';
      }
    } else {
      this.daysWithoutFood++;
      if (this.daysWithoutFood >= PredatorSprite.STARVE_DAYS) {
        this.die();
      }
    }
  }
}
