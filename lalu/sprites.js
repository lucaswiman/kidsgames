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

    // Trees don't move
    move(numTicks) {
        return false;
    }
}

// Lalu sprite with hunger state machine
class LaluSprite extends Sprite {
    constructor(id, x, y, getVisibleSprites) {
        super(id, 'lalu', x, y, getVisibleSprites);
        this.homeX = x;
        this.homeY = y;
        this.state = 'healthy';
        this.hungerLevel = 0;
        this.fruitEaten = 0; // Track fruit eaten within current hunger level
        this.gender = Math.random() < 0.5 ? 'male' : 'female';
    }

    computeClassNames() {
        return ['sprite', 'lalu'];
    }

    getTitle() {
        return `Lalu (${this.state}, ${this.gender})`;
    }

    getWidth() {
        return 50;
    }

    getHeight() {
        return 50;
    }

    getBackgroundImage() {
        return 'url("lalu-transparent.png")';
    }

    getStyle() {
        const style = {
            backgroundColor: 'transparent',
            borderRadius: '0'
        };

        // Add visual indicator for lalu state
        if (this.state === 'hungry') {
            style.border = '2px solid #FFA500';
        } else if (this.state === 'starving') {
            style.border = '2px solid #FF0000';
        } else if (this.state === 'dead') {
            style.opacity = '0.5';
            style.filter = 'grayscale(100%)';
        }

        return style;
    }

    // Lalu state machine: healthy -> hungry -> starving -> dead
    updateHungerState() {
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
        if (this.state !== 'dead') {
            this.hungerLevel++;
            this.updateHungerState();
        }
    }

    eatFruit() {
        if (this.state !== 'dead' && this.hungerLevel > 0) {
            // Calculate how much fruit this lalu needs to get to healthy (hunger level 0)
            const fruitNeeded = (this.hungerLevel * 3) - this.fruitEaten;
            
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
        return this.state !== 'dead' && this.hungerLevel > 0;
    }

    isAlive() {
        return this.state !== 'dead';
    }

    // Movement logic for hungry lalus
    getTargetPosition() {
        if (this.state === 'hungry' || this.state === 'starving') {
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

            if (nearestTree && !this.isCollidingWith(nearestTree)) {
                return { x: nearestTree.getCenterX(), y: nearestTree.getCenterY() };
            } else {
                // No fruit trees or already at tree, head to home
                return { x: this.homeX + this.getWidth()/2, y: this.homeY + this.getHeight()/2 };
            }
        } else if (this.state === 'healthy') {
            // Head towards home position
            return { x: this.homeX + this.getWidth()/2, y: this.homeY + this.getHeight()/2 };
        }
        
        return null; // Dead or no target
    }

    moveTowards(targetX, targetY, moveSpeed = 3) {
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

    // Handle collision with other sprites
    onCollision(otherSprite) {
        if (otherSprite.type === 'tree' && this.needsFood()) {
            // Calculate how much fruit this lalu can eat
            const fruitNeeded = Math.min(
                (this.hungerLevel * 3) - this.fruitEaten,
                otherSprite.fruitCount
            );
            
            // Eat fruit one by one until satisfied or tree is empty
            let fruitEaten = 0;
            while (fruitEaten < fruitNeeded && otherSprite.fruitCount > 0 && this.needsFood()) {
                if (otherSprite.harvestFruit() && this.eatFruit()) {
                    fruitEaten++;
                }
            }
            
            return fruitEaten > 0; // Return true if any fruit was consumed
        }
        return false;
    }

    createGenderLabel() {
        const genderLabel = document.createElement('div');
        genderLabel.className = `gender-label gender-${this.gender}`;
        return genderLabel;
    }

    // Movement logic called each game tick
    move(numTicks) {
        if (!this.isAlive()) {
            return false; // Dead lalus don't move
        }

        const target = this.getTargetPosition();
        
        if (target) {
            return this.moveTowards(target.x, target.y);
        }
        
        return false;
    }
}

// Factory function to create sprites
function createSprite(type, x, y, getVisibleSprites) {
    const id = `${type}_${Math.random().toString(36).substr(2, 9)}`;
    
    switch (type) {
        case 'tree':
            return new TreeSprite(id, x, y, getVisibleSprites);
        case 'lalu':
            return new LaluSprite(id, x, y, getVisibleSprites);
        default:
            throw new Error(`Unknown sprite type: ${type}`);
    }
}
