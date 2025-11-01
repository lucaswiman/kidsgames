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

    // Override in subclasses - called each game tick for movement
    move(numTicks) {
        // Base implementation does nothing
        return false; // Return true if position changed
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
