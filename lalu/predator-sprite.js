// Predator sprite (a fox) that hunts lalus outside their nests
// Fox state machine: cub -> hunting <-> sleeping, and hunting -> dead when starved
class PredatorSprite extends Sprite {
  constructor(id, x, y, getVisibleSprites, mother = null) {
    super(id, 'predator', x, y, getVisibleSprites);
    this.state = mother ? 'cub' : 'hunting';
    this.sleepDaysLeft = 0;
    this.daysWithoutFood = 0; // Only counts days spent awake
    this.wanderTarget = null;
    this.gender = Math.random() < 0.5 ? 'male' : 'female';
    this.mother = mother; // Reference to mother for cubs
    this.cubAge = 0; // Days as a cub
    this.hasReproduced = false; // Track if this fox has reproduced this day
  }

  static SIGHT_RANGE = 250; // How far away (px) the fox can spot a lalu
  static SLEEP_DAYS = 2; // Days the fox sleeps after eating
  static STARVE_DAYS = 3; // Awake days without eating before the fox starves
  static CUB_DAYS = 5; // Days before a cub grows up

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
    if (this.state === 'cub') {
      return `Fox cub (${this.gender}, ${this.cubAge} days)`;
    }
    if (this.state === 'sleeping') {
      return `Fox (sleeping, ${this.gender}, ${this.sleepDaysLeft} days left)`;
    }
    return `Fox (hunting, ${this.gender}, ${this.daysWithoutFood}/${PredatorSprite.STARVE_DAYS} days without food)`;
  }

  getWidth() {
    return this.state === 'cub' ? 30 : 60;
  }

  getHeight() {
    return this.state === 'cub' ? 30 : 60;
  }

  getLabel() {
    return '🦊';
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

  isAlive() {
    return this.state !== 'dead';
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

  // Like healthy lalus, only well-fed foxes breed; sleeping foxes and cubs can't
  canReproduce() {
    return (
      this.state === 'hunting' &&
      this.daysWithoutFood === 0 &&
      !this.hasReproduced &&
      !this.hasCurrentCub()
    );
  }

  canMateWith(otherSprite) {
    return (
      otherSprite.type === 'predator' &&
      otherSprite.gender !== this.gender &&
      this.canReproduce() &&
      otherSprite.canReproduce()
    );
  }

  hasCurrentCub() {
    // Check if this fox is currently a mother with a cub following her
    if (this.gender !== 'female') {
      return false;
    }
    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
    return visibleSprites.some(
      sprite => sprite.type === 'predator' && sprite.state === 'cub' && sprite.mother === this
    );
  }

  findNearest(sprites, maxDistance = Infinity) {
    let nearest = null;
    let minDistance = maxDistance;
    sprites.forEach(sprite => {
      const distance = this.distanceTo(sprite);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = sprite;
      }
    });
    return nearest;
  }

  getTargetPosition() {
    if (this.state === 'cub') {
      // Cubs follow their mother
      return this.mother ? { x: this.mother.getCenterX(), y: this.mother.getCenterY() } : null;
    }
    if (this.state !== 'hunting') {
      return null;
    }

    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];

    // Well-fed foxes seek the nearest available mate
    const nearestMate = this.findNearest(visibleSprites.filter(s => this.canMateWith(s)));
    if (nearestMate) {
      this.wanderTarget = null;
      return { x: nearestMate.getCenterX(), y: nearestMate.getCenterY() };
    }

    // Otherwise chase the nearest catchable lalu in sight
    const nearestPrey = this.findNearest(
      visibleSprites.filter(s => this.canCatch(s)),
      PredatorSprite.SIGHT_RANGE
    );
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
    if (this.canMateWith(otherSprite)) {
      const mother = this.gender === 'female' ? this : otherSprite;
      this.createCub(mother);
      this.hasReproduced = true;
      otherSprite.hasReproduced = true;
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

  createCub(mother) {
    if (window.game) {
      const cub = new PredatorSprite(
        `predator_${Math.random().toString(36).substr(2, 9)}`,
        mother.x + Math.random() * 20 - 10, // Near mother
        mother.y + Math.random() * 20 - 10,
        this.getVisibleSprites,
        mother
      );
      window.game.sprites.push(cub);
    }
  }

  handleDeath() {
    // Cubs can't survive without their mother
    if (window.game) {
      window.game.sprites.forEach(sprite => {
        if (sprite.type === 'predator' && sprite.state === 'cub' && sprite.mother === this) {
          sprite.state = 'dead';
        }
      });
    }
  }

  onDayEnd() {
    if (this.state === 'cub') {
      // Cubs don't get hungry; they grow up after CUB_DAYS days
      this.cubAge++;
      if (this.cubAge >= PredatorSprite.CUB_DAYS) {
        this.state = 'hunting';
        this.mother = null;
      }
    } else if (this.state === 'sleeping') {
      // Sleeping foxes don't get hungrier
      this.sleepDaysLeft--;
      if (this.sleepDaysLeft <= 0) {
        this.state = 'hunting';
      }
    } else if (this.state === 'hunting') {
      this.daysWithoutFood++;
      if (this.daysWithoutFood >= PredatorSprite.STARVE_DAYS) {
        this.state = 'dead';
        this.handleDeath();
      }
    }

    // Reset reproduction flag each day
    this.hasReproduced = false;
  }
}
