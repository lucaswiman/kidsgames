// Lalu sprite with hunger state machine
class LaluSprite extends Sprite {
    constructor(id, x, y, getVisibleSprites, nest) {
        super(id, 'lalu', x, y, getVisibleSprites);
        this.nest = nest;
        this.homeX = nest ? nest.x : x;
        this.homeY = nest ? nest.y : y;
        this.state = 'healthy';
        this.hungerLevel = 0;
        this.fruitEaten = 0; // Track fruit eaten within current hunger level
        this.gender = Math.random() < 0.5 ? 'male' : 'female';
        this.inNest = true; // Start in nest
    }

    computeClassNames() {
        const classes = ['sprite', 'lalu'];
        if (this.inNest) {
            classes.push('in-nest');
        }
        return classes;
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

    // Check if lalu is at nest position
    isAtNest() {
        if (!this.nest) return false;
        const distance = Math.sqrt(
            Math.pow(this.getCenterX() - this.nest.getCenterX(), 2) + 
            Math.pow(this.getCenterY() - this.nest.getCenterY(), 2)
        );
        return distance < 25; // Within nest radius
    }

    // Override getTargetPosition for lalu-specific movement logic
    getTargetPosition() {
        if (this.state === 'hungry' || this.state === 'starving') {
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
                return { x: this.homeX + this.getWidth()/2, y: this.homeY + this.getHeight()/2 };
            }
        } else if (this.state === 'healthy') {
            // Head towards home position (nest)
            if (this.isAtNest()) {
                this.inNest = true;
                return null; // Already at nest, don't move
            } else {
                this.inNest = false;
                return { x: this.homeX + this.getWidth()/2, y: this.homeY + this.getHeight()/2 };
            }
        }
        
        return null; // Dead or no target
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

    // Override move to handle dead lalus
    move(numTicks) {
        if (!this.isAlive()) {
            return false; // Dead lalus don't move
        }
        
        // Use base class movement logic
        return super.move(numTicks);
    }
}
