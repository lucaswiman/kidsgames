// Nest sprite
class NestSprite extends Sprite {
    constructor(id, x, y, getVisibleSprites) {
        super(id, 'nest', x, y, getVisibleSprites);
    }

    computeClassNames() {
        return ['sprite', 'nest'];
    }

    getTitle() {
        return 'Nest';
    }

    getWidth() {
        return 40;
    }

    getHeight() {
        return 40;
    }

    getStyle() {
        return {
            backgroundColor: '#8B4513',
            borderRadius: '50%'
        };
    }

    // Nests don't move
    move(numTicks) {
        return false;
    }
}
