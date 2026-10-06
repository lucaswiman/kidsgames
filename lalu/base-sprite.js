// Base Sprite class
class Sprite {
  constructor(id, type, x, y, getVisibleSprites) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.getVisibleSprites = getVisibleSprites;
  }

  // Override in subclasses
  computeClassNames() {
    return ['sprite', this.type];
  }

  // Override in subclasses
  getTitle() {
    return `${this.type}`;
  }

  // Override in subclasses
  getWidth() {
    return 20;
  }

  // Override in subclasses
  getHeight() {
    return 20;
  }

  // Override in subclasses
  getBackgroundImage() {
    return null;
  }

  // Badge showing M/F for sprites that have a gender
  createGenderLabel() {
    const genderLabel = document.createElement('div');
    genderLabel.className = `gender-label gender-${this.gender}`;
    return genderLabel;
  }

  // Override in subclasses
  getStyle() {
    return {};
  }

  // Override in subclasses
  update(deltaTime) {
    // Base implementation does nothing
  }

  // Override in subclasses to specify where sprite wants to move
  getTargetPosition() {
    // Default: stay at current position
    return { x: this.getCenterX(), y: this.getCenterY() };
  }

  // Get maximum movement speed per tick
  getMaxVelocity() {
    return 4; // Default movement speed
  }

  // Move towards target position - called each game tick
  move(numTicks) {
    const target = this.getTargetPosition();

    if (!target) {
      return false; // No target, don't move
    }

    return this.moveTowards(target.x, target.y, this.getMaxVelocity());
  }

  // Helper method to move towards a target position
  moveTowards(targetX, targetY, moveSpeed) {
    // Calculate direction vector
    const dx = targetX - this.getCenterX();
    const dy = targetY - this.getCenterY();
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Only move if not already at target
    if (distance > 5) {
      // Normalize and apply movement
      const moveX = (dx / distance) * moveSpeed;
      const moveY = (dy / distance) * moveSpeed;

      // Update position using the base class method
      this.updatePosition(this.x + moveX, this.y + moveY);

      return true; // Moved
    }

    return false; // Already at target
  }

  // Position updating method
  updatePosition(newX, newY) {
    this.x = Math.max(0, Math.min(window.innerWidth - this.getWidth(), newX));
    this.y = Math.max(0, Math.min(window.innerHeight - this.getHeight(), newY));
  }

  // Get center coordinates
  getCenterX() {
    return this.x + this.getWidth() / 2;
  }

  getCenterY() {
    return this.y + this.getHeight() / 2;
  }

  distanceTo(sprite) {
    return Math.sqrt(
      Math.pow(this.getCenterX() - sprite.getCenterX(), 2) +
        Math.pow(this.getCenterY() - sprite.getCenterY(), 2)
    );
  }

  // Returns the closest of the given sprites within maxDistance, or null
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

  // Picks random spots the sprite's center can actually reach, and a new one on arrival
  getWanderTarget() {
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

  // Check collision with another sprite
  isCollidingWith(otherSprite) {
    const distance = Math.sqrt(
      Math.pow(this.getCenterX() - otherSprite.getCenterX(), 2) +
        Math.pow(this.getCenterY() - otherSprite.getCenterY(), 2)
    );
    const combinedRadius = (this.getWidth() + otherSprite.getWidth()) / 4; // Approximate radius
    return distance < combinedRadius;
  }

  // Override in subclasses to handle collisions
  onCollision(otherSprite) {
    // Base implementation does nothing
  }
}
