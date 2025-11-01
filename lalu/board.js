class GameBoard {
    constructor() {
        this.sprites = [];
        this.config = this.loadConfig();
        this.lastDayUpdate = Date.now();
        this.dayCount = 1;
        this.dragState = {
            isDragging: false,
            dragSprite: null,
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0
        };
        this.setupBoard();
        this.generateSprites();
        this.setupModal();
        this.setupDayTicker();
        this.setupDragHandlers();
        this.startGameLoop();
    }

    loadConfig() {
        const defaultConfig = {
            numTrees: 5,
            numLalus: 2,
            numNests: 2
        };
        const saved = localStorage.getItem('laluGameConfig');
        return saved ? JSON.parse(saved) : defaultConfig;
    }

    saveConfig() {
        localStorage.setItem('laluGameConfig', JSON.stringify(this.config));
    }

    setupBoard() {
        const board = document.getElementById('game-board');
        board.style.width = '100vw';
        board.style.height = '100vh';
        board.style.position = 'relative';
        board.style.overflow = 'hidden';
        board.style.backgroundColor = '#87CEEB';
    }

    setupDayTicker() {
        const ticker = document.createElement('div');
        ticker.className = 'day-ticker';
        ticker.id = 'day-ticker';
        ticker.innerHTML = `
            <div>Day ${this.dayCount}</div>
            <div class="progress-bar">
                <div class="progress-fill" id="day-progress"></div>
            </div>
        `;
        document.body.appendChild(ticker);
    }

    updateDayTicker() {
        const ticker = document.getElementById('day-ticker');
        if (ticker) {
            const now = Date.now();
            const dayProgress = ((now - this.lastDayUpdate) / 10000) * 100; // 10 seconds = 1 day
            const progressFill = document.getElementById('day-progress');
            
            ticker.querySelector('div').textContent = `Day ${this.dayCount}`;
            if (progressFill) {
                progressFill.style.width = Math.min(100, dayProgress) + '%';
            }
        }
    }

    getVisibleSprites(sprite) {
        // Default behavior returns all sprites except the requesting sprite
        return this.sprites.filter(s => s !== sprite);
    }


    createNest() {
        const x = Math.random() * (window.innerWidth - 40);
        const y = Math.random() * (window.innerHeight - 40);
        return createSprite('nest', x, y, this.getVisibleSprites.bind(this));
    }

    createTree() {
        const x = Math.random() * (window.innerWidth - 80);
        const y = Math.random() * (window.innerHeight - 80);
        return createSprite('tree', x, y, this.getVisibleSprites.bind(this));
    }

    createLalu(nest) {
        return createSprite('lalu', nest.x, nest.y, this.getVisibleSprites.bind(this), nest);
    }

    renderSprites() {
        const board = document.getElementById('game-board');
        
        // Clear existing sprites
        const existingSprites = board.querySelectorAll('.sprite');
        existingSprites.forEach(sprite => sprite.remove());
        
        // Render all sprites
        this.sprites.forEach(sprite => {
            const element = document.createElement('div');
            element.className = sprite.computeClassNames().join(' ');
            element.id = sprite.id;
            element.style.position = 'absolute';
            element.style.left = sprite.x + 'px';
            element.style.top = sprite.y + 'px';
            element.style.width = sprite.getWidth() + 'px';
            element.style.height = sprite.getHeight() + 'px';
            element.style.cursor = 'pointer';
            element.title = sprite.getTitle();
            
            // Apply sprite-specific styles
            const spriteStyle = sprite.getStyle();
            Object.assign(element.style, spriteStyle);
            
            // Set background image if provided
            const backgroundImage = sprite.getBackgroundImage();
            if (backgroundImage) {
                element.style.backgroundImage = backgroundImage;
                element.style.backgroundSize = 'contain';
                element.style.backgroundRepeat = 'no-repeat';
                element.style.backgroundPosition = 'center';
            }
            
            if (sprite.type === 'lalu') {
                // Add gender label
                element.appendChild(sprite.createGenderLabel());
            }
            
            board.appendChild(element);
        });
    }


    setupModal() {
        // Create settings button
        const settingsBtn = document.createElement('button');
        settingsBtn.innerHTML = '⚙️';
        settingsBtn.className = 'settings-btn';
        settingsBtn.onclick = () => this.showModal();
        document.body.appendChild(settingsBtn);

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'settings-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Game Settings</h2>
                <div class="setting">
                    <label for="num-trees">Number of Trees:</label>
                    <input type="number" id="num-trees" min="1" max="20" value="${this.config.numTrees}">
                </div>
                <div class="setting">
                    <label for="num-lalus">Number of Lalus:</label>
                    <input type="number" id="num-lalus" min="1" max="10" value="${this.config.numLalus}">
                </div>
                <div class="setting">
                    <label for="num-nests">Number of Nests:</label>
                    <input type="number" id="num-nests" min="1" max="5" value="${this.config.numNests}">
                </div>
                <button onclick="game.saveSettings()">Save Settings</button>
            </div>
        `;
        document.body.appendChild(modal);

        // Close modal functionality
        modal.querySelector('.close').onclick = () => this.hideModal();
        modal.onclick = (e) => {
            if (e.target === modal) this.hideModal();
        };
    }

    showModal() {
        document.getElementById('settings-modal').style.display = 'block';
    }

    hideModal() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    saveSettings() {
        const numTrees = parseInt(document.getElementById('num-trees').value);
        const numLalus = parseInt(document.getElementById('num-lalus').value);
        const numNests = parseInt(document.getElementById('num-nests').value);
        
        this.config.numTrees = numTrees;
        this.config.numLalus = numLalus;
        this.config.numNests = numNests;
        this.saveConfig();
        
        this.generateSprites();
        this.hideModal();
    }

    setupDragHandlers() {
        const board = document.getElementById('game-board');
        
        // Mouse events
        board.addEventListener('mousedown', (e) => this.handleDragStart(e));
        board.addEventListener('mousemove', (e) => this.handleDragMove(e));
        board.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        
        // Touch events
        board.addEventListener('touchstart', (e) => this.handleDragStart(e), { passive: false });
        board.addEventListener('touchmove', (e) => this.handleDragMove(e), { passive: false });
        board.addEventListener('touchend', (e) => this.handleDragEnd(e));
    }

    getEventCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    handleDragStart(e) {
        const target = e.target;
        if (!target.classList.contains('lalu')) return;
        
        const sprite = this.sprites.find(s => s.id === target.id);
        if (!sprite || !sprite.isAlive()) return;
        
        e.preventDefault();
        const coords = this.getEventCoords(e);
        
        this.dragState.isDragging = true;
        this.dragState.dragSprite = sprite;
        this.dragState.startX = coords.x;
        this.dragState.startY = coords.y;
        this.dragState.offsetX = coords.x - sprite.x;
        this.dragState.offsetY = coords.y - sprite.y;
        
        target.classList.add('dragging');
    }

    handleDragMove(e) {
        if (!this.dragState.isDragging || !this.dragState.dragSprite) return;
        
        e.preventDefault();
        const coords = this.getEventCoords(e);
        
        const newX = coords.x - this.dragState.offsetX;
        const newY = coords.y - this.dragState.offsetY;
        
        this.dragState.dragSprite.updatePosition(newX, newY);
        
        const element = document.getElementById(this.dragState.dragSprite.id);
        if (element) {
            element.style.left = this.dragState.dragSprite.x + 'px';
            element.style.top = this.dragState.dragSprite.y + 'px';
        }
        
        // Check for collisions and render if needed
        if (this.checkCollisions(this.dragState.dragSprite)) {
            this.renderSprites();
        }
    }

    handleDragEnd(e) {
        if (!this.dragState.isDragging) return;
        
        const element = document.getElementById(this.dragState.dragSprite.id);
        if (element) {
            element.classList.remove('dragging');
        }
        
        this.dragState.isDragging = false;
        this.dragState.dragSprite = null;
    }

    checkCollisions(sprite) {
        let needsRender = false;
        
        this.sprites.forEach(otherSprite => {
            if (sprite !== otherSprite && sprite.isCollidingWith(otherSprite)) {
                if (sprite.onCollision(otherSprite)) {
                    needsRender = true;
                }
            }
        });
        
        return needsRender;
    }


    moveSprites(numTicks) {
        let needsRender = false;

        this.sprites.forEach(sprite => {
            // Skip movement if sprite is being dragged
            if (this.dragState.isDragging && sprite === this.dragState.dragSprite) {
                return;
            }
            
            // Call move method on each sprite
            if (sprite.move(numTicks)) {
                needsRender = true;
                
                // Check for collisions after movement
                if (this.checkCollisions(sprite)) {
                    needsRender = true;
                }
            }
        });

        if (needsRender) {
            this.renderSprites();
        }
    }

    startGameLoop() {
        setInterval(() => {
            this.updateGame();
        }, 100);
    }

    updateGame() {
        const now = Date.now();
        let needsRender = false;

        // Check if a day has passed (for demo purposes, let's say 10 seconds = 1 day)
        if (now - this.lastDayUpdate > 10000) {
            this.processDayEnd();
            this.lastDayUpdate = now;
            needsRender = true;
        }

        // Update tree fruit growing
        this.sprites.forEach(sprite => {
            if (sprite.type === 'tree') {
                if (sprite.update(100)) {
                    needsRender = true;
                    
                    // Check if any lalu is touching this tree when fruit grows
                    this.sprites.forEach(otherSprite => {
                        if (otherSprite.type === 'lalu' && otherSprite.isAlive() && sprite.isCollidingWith(otherSprite)) {
                            if (otherSprite.onCollision(sprite)) {
                                needsRender = true;
                            }
                        }
                    });
                }
            }
        });

        // Move all sprites and check collisions
        this.moveSprites(1);

        // Update day progress bar
        this.updateDayTicker();

        if (needsRender) {
            this.renderSprites();
        }
    }

    processDayEnd() {
        // Increase hunger for all living lalus
        this.sprites.forEach(sprite => {
            if (sprite.type === 'lalu') {
                sprite.increaseHunger();
            }
        });
        
        // Increment day counter
        this.dayCount++;
        this.updateDayTicker();
    }
}

// Initialize game when page loads
let game;
window.addEventListener('load', () => {
    game = new GameBoard();
    // Make game globally accessible for sprites
    window.game = game;
});

// Handle window resize
window.addEventListener('resize', () => {
    if (game) {
        game.setupBoard();
        game.renderSprites();
    }
});

// Prevent default touch behaviors that might interfere with dragging
document.addEventListener('touchmove', (e) => {
    if (e.target.classList.contains('lalu')) {
        e.preventDefault();
    }
}, { passive: false });
