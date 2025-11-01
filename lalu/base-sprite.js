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
