// Shared behavior for animals that breed, raise babies and grow old (foxes and omnivores).
// Subclasses provide getAdultState() and isReadyToBreed(), and pass (mother, father) through
// their constructor so babies can be created with `new this.constructor(...)`.
class AnimalSprite extends Sprite {
  constructor(id, type, x, y, getVisibleSprites, mother = null) {
    super(id, type, x, y, getVisibleSprites);
    this.state = mother ? 'baby' : this.getAdultState();
    this.gender = Math.random() < 0.5 ? 'male' : 'female';
    this.mother = mother; // Babies follow their mother
    this.babyAge = 0; // Days as a baby
    this.age = 0; // Days as an adult; the animal dies of old age at getLifespan()
    this.hasReproduced = false; // Track if this animal has reproduced this day
  }

  static BABY_DAYS = 5; // Days before a baby grows up

  // Override in subclasses: the state a grown-up animal starts in
  getAdultState() {
    return 'alive';
  }

  // Override in subclasses: whether an adult is in good enough shape to breed
  isReadyToBreed() {
    return true;
  }

  getLifespan() {
    return 50;
  }

  isAlive() {
    return this.state !== 'dead';
  }

  isBaby() {
    return this.state === 'baby';
  }

  canReproduce() {
    return (
      this.isAlive() &&
      !this.isBaby() &&
      this.isReadyToBreed() &&
      !this.hasReproduced &&
      !this.hasCurrentBaby()
    );
  }

  canMateWith(otherSprite) {
    return (
      otherSprite.type === this.type &&
      otherSprite.gender !== this.gender &&
      this.canReproduce() &&
      otherSprite.canReproduce()
    );
  }

  hasCurrentBaby() {
    // Check if this animal is currently a mother with a baby following her
    if (this.gender !== 'female') {
      return false;
    }
    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
    return visibleSprites.some(
      sprite => sprite.type === this.type && sprite.isBaby() && sprite.mother === this
    );
  }

  findNearestMate() {
    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
    return this.findNearest(visibleSprites.filter(s => this.canMateWith(s)));
  }

  getMotherPosition() {
    return this.mother ? { x: this.mother.getCenterX(), y: this.mother.getCenterY() } : null;
  }

  // Have a baby with otherSprite; returns false if the two can't mate right now
  breedWith(otherSprite) {
    if (!this.canMateWith(otherSprite)) {
      return false;
    }
    const mother = this.gender === 'female' ? this : otherSprite;
    const father = mother === this ? otherSprite : this;
    if (window.game) {
      const baby = new this.constructor(
        `${this.type}_${Math.random().toString(36).substr(2, 9)}`,
        mother.x + Math.random() * 20 - 10, // Near mother
        mother.y + Math.random() * 20 - 10,
        this.getVisibleSprites,
        mother,
        father
      );
      window.game.sprites.push(baby);
    }
    this.hasReproduced = true;
    otherSprite.hasReproduced = true;
    return true;
  }

  die() {
    this.state = 'dead';
    this.handleDeath();
  }

  handleDeath() {
    // Babies can't survive without their mother
    if (window.game) {
      window.game.sprites.forEach(sprite => {
        if (sprite.type === this.type && sprite.isBaby() && sprite.mother === this) {
          sprite.state = 'dead';
        }
      });
    }
  }

  // Grow up or grow old by one day. Returns true if the animal is a living adult
  // afterwards, so subclasses know whether to apply their own daily hunger.
  ageOneDay() {
    this.hasReproduced = false;
    if (this.isBaby()) {
      this.babyAge++;
      if (this.babyAge >= AnimalSprite.BABY_DAYS) {
        this.state = this.getAdultState();
        this.mother = null;
      }
      return false;
    }
    if (!this.isAlive()) {
      return false;
    }
    this.age++;
    if (this.age >= this.getLifespan()) {
      this.die(); // Old age
      return false;
    }
    return true;
  }
}
