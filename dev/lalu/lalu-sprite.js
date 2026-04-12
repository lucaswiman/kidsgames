// Lalu sprite with hunger state machine
class LaluSprite extends Sprite {
  constructor(id, x, y, getVisibleSprites, nest, mother = null) {
    super(id, 'lalu', x, y, getVisibleSprites);
    this.nest = nest;
    this.homeX = nest ? nest.x : x;
    this.homeY = nest ? nest.y : y;
    this.state = mother ? 'baby' : 'healthy';
    this.hungerLevel = 0;
    this.fruitEaten = 0; // Track fruit eaten within current hunger level
    this.gender = Math.random() < 0.5 ? 'male' : 'female';
    this.inNest = true; // Start in nest
    this.mother = mother; // Reference to mother for babies
    this.babyAge = 0; // Days as a baby
    this.hasReproduced = false; // Track if this lalu has reproduced this day
  }

  computeClassNames() {
    const classes = ['sprite', 'lalu'];
    if (this.inNest) {
      classes.push('in-nest');
    }
    return classes;
  }

  getTitle() {
    if (this.state === 'baby') {
      return `Baby Lalu (${this.gender}, ${this.babyAge} days)`;
    }
    return `Lalu (${this.state}, ${this.gender})`;
  }

  getWidth() {
    return this.state === 'baby' ? 25 : 50;
  }

  getHeight() {
    return this.state === 'baby' ? 25 : 50;
  }

  getBackgroundImage() {
    return 'url("lalu-transparent.png")';
  }

  getStyle() {
    const style = {
      backgroundColor: 'transparent',
      borderRadius: '0',
    };

    // Add visual indicator for lalu state
    if (this.state === 'baby') {
      style.border = '2px solid #FFB6C1';
    } else if (this.state === 'hungry') {
      style.border = '2px solid #FFA500';
    } else if (this.state === 'starving') {
      style.border = '2px solid #FF0000';
    } else if (this.state === 'dead') {
      style.opacity = '0.5';
      style.filter = 'grayscale(100%)';
    }

    return style;
  }

  // Lalu state machine: baby -> healthy -> hungry -> starving -> dead
  updateHungerState() {
    if (this.state === 'baby') {
      // Babies don't get hungry, they follow their mother
      return;
    }

    if (this.hungerLevel === 0) {
      this.state = 'healthy';
    } else if (this.hungerLevel === 1) {
      this.state = 'hungry';
    } else if (this.hungerLevel === 2) {
      this.state = 'starving';
    } else if (this.hungerLevel >= 3) {
      this.state = 'dead';
    }
  }

  increaseHunger() {
    if (this.state === 'baby') {
      this.babyAge++;
      if (this.babyAge >= 5) {
        // Baby grows up after 5 days
        this.state = 'healthy';
        this.mother = null; // No longer needs to follow mother
        this.createNewNest(); // Create a new nest when growing up
      }
    } else if (this.state !== 'dead') {
      this.hungerLevel++;
      this.updateHungerState();

      // If lalu just died, handle death consequences
      if (this.state === 'dead') {
        this.handleDeath();
      }
    }

    // Reset reproduction flag each day
    this.hasReproduced = false;
  }

  eatFruit() {
    if (this.state !== 'dead' && this.hungerLevel > 0) {
      // Calculate how much fruit this lalu needs to get to healthy (hunger level 0)
      const fruitNeeded = this.hungerLevel * 3 - this.fruitEaten;

      // Only eat if the lalu actually needs fruit
      if (fruitNeeded > 0) {
        this.fruitEaten++;

        // Check if lalu has eaten enough fruit to reduce hunger level
        if (this.fruitEaten >= 3) {
          this.hungerLevel = Math.max(0, this.hungerLevel - 1);
          this.fruitEaten = 0; // Reset fruit counter
          this.updateHungerState();
        }
        return true; // Successfully ate fruit
      }
    }
    return false; // Couldn't eat fruit
  }

  needsFood() {
    return this.state !== 'dead' && this.state !== 'baby' && this.hungerLevel > 0;
  }

  isAlive() {
    return this.state !== 'dead';
  }

  // Check if lalu is at nest position
  isAtNest() {
    if (!this.nest) {
      return false;
    }
    const distance = Math.sqrt(
      Math.pow(this.getCenterX() - this.nest.getCenterX(), 2) +
        Math.pow(this.getCenterY() - this.nest.getCenterY(), 2)
    );
    return distance < 25; // Within nest radius
  }

  // Override getTargetPosition for lalu-specific movement logic
  getTargetPosition() {
    if (this.state === 'baby' && this.mother && this.mother.isAlive()) {
      // Babies follow their mother
      return { x: this.mother.getCenterX(), y: this.mother.getCenterY() };
    } else if (this.state === 'hungry' || this.state === 'starving') {
      this.inNest = false; // Leave nest when hungry

      // Get visible sprites and find trees with fruit
      const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
      const fruitTrees = visibleSprites.filter(s => s.type === 'tree' && s.fruitCount > 0);

      // Find nearest tree with fruit
      let nearestTree = null;
      let minDistance = Infinity;

      fruitTrees.forEach(tree => {
        const distance = Math.sqrt(
          Math.pow(this.getCenterX() - tree.getCenterX(), 2) +
            Math.pow(this.getCenterY() - tree.getCenterY(), 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearestTree = tree;
        }
      });

      if (nearestTree) {
        if (!this.isCollidingWith(nearestTree)) {
          // Move towards the tree
          return { x: nearestTree.getCenterX(), y: nearestTree.getCenterY() };
        } else {
          // Already at tree, stay here to harvest fruit
          return null; // Don't move, let collision system handle fruit eating
        }
      } else {
        // No fruit trees available, head to home
        return { x: this.homeX + this.getWidth() / 2, y: this.homeY + this.getHeight() / 2 };
      }
    } else if (this.state === 'healthy') {
      // If not a mother with a current baby, seek potential mates
      if (!this.hasCurrentBaby()) {
        const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
        const potentialMates = visibleSprites.filter(
          sprite =>
            sprite.type === 'lalu' &&
            sprite.state === 'healthy' &&
            sprite.gender !== this.gender &&
            sprite.isAlive() &&
            !sprite.hasReproduced &&
            !this.hasReproduced &&
            !sprite.hasCurrentBaby()
        );

        // Find nearest potential mate
        let nearestMate = null;
        let minDistance = Infinity;

        potentialMates.forEach(mate => {
          const distance = Math.sqrt(
            Math.pow(this.getCenterX() - mate.getCenterX(), 2) +
              Math.pow(this.getCenterY() - mate.getCenterY(), 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestMate = mate;
          }
        });

        if (nearestMate) {
          this.inNest = false;
          return { x: nearestMate.getCenterX(), y: nearestMate.getCenterY() };
        }
      }

      // Default behavior: head towards home position (nest)
      if (this.isAtNest()) {
        this.inNest = true;
        return null; // Already at nest, don't move
      } else {
        this.inNest = false;
        return { x: this.homeX + this.getWidth() / 2, y: this.homeY + this.getHeight() / 2 };
      }
    }

    return null; // Dead or no target
  }

  // Handle collision with other sprites
  onCollision(otherSprite) {
    if (otherSprite.type === 'tree' && this.needsFood()) {
      // Calculate how much fruit this lalu can eat
      const fruitNeeded = Math.min(this.hungerLevel * 3 - this.fruitEaten, otherSprite.fruitCount);

      // Eat fruit one by one until satisfied or tree is empty
      let fruitEaten = 0;
      while (fruitEaten < fruitNeeded && otherSprite.fruitCount > 0 && this.needsFood()) {
        if (otherSprite.harvestFruit() && this.eatFruit()) {
          fruitEaten++;
        }
      }

      return fruitEaten > 0; // Return true if any fruit was consumed
    } else if (otherSprite.type === 'lalu' && this.canReproduce() && otherSprite.canReproduce()) {
      // Check if this is a male-female pair that can reproduce
      if (
        this.gender !== otherSprite.gender &&
        !this.hasReproduced &&
        !otherSprite.hasReproduced &&
        !this.hasCurrentBaby() &&
        !otherSprite.hasCurrentBaby()
      ) {
        // Determine which is the female (will be the mother)
        const female = this.gender === 'female' ? this : otherSprite;
        const male = this.gender === 'male' ? this : otherSprite;

        // Create baby near the female
        this.createBaby(female);

        // Mark both parents as having reproduced this day
        this.hasReproduced = true;
        otherSprite.hasReproduced = true;

        return true; // Indicate state change for re-rendering
      }
    }
    return false;
  }

  createGenderLabel() {
    const genderLabel = document.createElement('div');
    genderLabel.className = `gender-label gender-${this.gender}`;
    return genderLabel;
  }

  canReproduce() {
    return this.state === 'healthy' && this.isAlive();
  }

  hasCurrentBaby() {
    // Check if this lalu is currently a mother with a baby following them
    if (this.gender !== 'female') {
      return false;
    }

    const visibleSprites = this.getVisibleSprites ? this.getVisibleSprites(this) : [];
    return visibleSprites.some(
      sprite => sprite.type === 'lalu' && sprite.state === 'baby' && sprite.mother === this
    );
  }

  createBaby(mother) {
    // Access the global game instance to add a new sprite
    if (window.game) {
      const babyX = mother.x + Math.random() * 20 - 10; // Near mother
      const babyY = mother.y + Math.random() * 20 - 10;
      const baby = new LaluSprite(
        `lalu_${Math.random().toString(36).substr(2, 9)}`,
        babyX,
        babyY,
        this.getVisibleSprites,
        mother.nest,
        mother
      );
      window.game.sprites.push(baby);
    }
  }

  createNewNest() {
    // Create a new nest at a random location when lalu grows up
    if (window.game) {
      const nestX = Math.random() * (window.innerWidth - 40);
      const nestY = Math.random() * (window.innerHeight - 40);
      const newNest = new NestSprite(
        `nest_${Math.random().toString(36).substr(2, 9)}`,
        nestX,
        nestY,
        this.getVisibleSprites
      );

      // Update this lalu's nest reference
      this.nest = newNest;
      this.homeX = nestX;
      this.homeY = nestY;

      // Add nest to game
      window.game.sprites.push(newNest);
    }
  }

  handleDeath() {
    // When a lalu dies, handle the consequences
    if (window.game) {
      // Remove this lalu's nest
      const nestIndex = window.game.sprites.findIndex(
        sprite => sprite.type === 'nest' && sprite === this.nest
      );
      if (nestIndex !== -1) {
        window.game.sprites.splice(nestIndex, 1);
      }

      // Kill any babies that have this lalu as their mother
      window.game.sprites.forEach(sprite => {
        if (sprite.type === 'lalu' && sprite.state === 'baby' && sprite.mother === this) {
          sprite.state = 'dead';
        }
      });
    }
  }

  // Override move to handle dead lalus
  move(numTicks) {
    if (!this.isAlive()) {
      return false; // Dead lalus don't move
    }

    // Use base class movement logic
    return super.move(numTicks);
  }
}
