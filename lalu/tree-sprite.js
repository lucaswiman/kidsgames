// Tree sprite with fruit state machine
class TreeSprite extends Sprite {
    constructor(id, x, y, getVisibleSprites) {
        super(id, 'tree', x, y, getVisibleSprites);
        this.fruitCount = Math.floor(Math.random() * 3); // 0, 1, or 2 pieces of fruit
        this.ripeTime = Math.random() * 10000; // Random time within current day
    }

    computeClassNames() {
        return ['sprite', 'tree'];
    }

    getTitle() {
        return `Tree (${this.fruitCount} fruit)`;
    }

    getWidth() {
        return 80;
    }

    getHeight() {
        return 80;
    }

    getBackgroundImage() {
        if (this.fruitCount === 0) {
            return 'url("tree-no-fruit-transparent.png")';
        } else if (this.fruitCount === 1) {
            return 'url("tree-1-fruit-transparent.png")';
        } else {
            return 'url("tree-2-fruit-transparent.png")';
        }
    }

    getStyle() {
        return {
            backgroundColor: 'transparent',
            borderRadius: '0'
        };
    }

    // Tree state machine: growing fruit over time
    update(deltaTime) {
        if (this.fruitCount < 2) {
            this.ripeTime -= deltaTime;
            if (this.ripeTime <= 0) {
                this.fruitCount++;
                this.ripeTime = Math.random() * 10000; // Reset for next fruit growth
                return true; // Indicate state changed
            }
        }
        return false;
    }

    harvestFruit() {
        if (this.fruitCount > 0) {
            this.fruitCount--;
            return true; // Successfully harvested
        }
        return false; // No fruit to harvest
    }

    // Handle collision with other sprites
    onCollision(otherSprite) {
        // Trees don't initiate actions on collision
    }

    // Trees stay at their current position
    getTargetPosition() {
        return { x: this.getCenterX(), y: this.getCenterY() };
    }
}
