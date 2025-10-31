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
            numLalus: 2
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

    generateSprites() {
        this.sprites = [];
        
        // Generate trees
        for (let i = 0; i < this.config.numTrees; i++) {
            this.sprites.push(this.createTree());
        }
        
        // Generate lalus
        for (let i = 0; i < this.config.numLalus; i++) {
            this.sprites.push(this.createLalu());
        }
        
        this.renderSprites();
    }

    createTree() {
        return {
            id: 'tree_' + Math.random().toString(36).substr(2, 9),
            type: 'tree',
            x: Math.random() * (window.innerWidth - 80),
            y: Math.random() * (window.innerHeight - 80),
            fruitCount: Math.floor(Math.random() * 3), // 0, 1, or 2 pieces of fruit
            ripeTime: Math.random() * 10000 // Random time within current day (0-10 seconds)
        };
    }

    createLalu() {
        const homeX = Math.random() * (window.innerWidth - 20);
        const homeY = Math.random() * (window.innerHeight - 20);
        return {
            id: 'lalu_' + Math.random().toString(36).substr(2, 9),
            type: 'lalu',
            x: homeX,
            y: homeY,
            homeX: homeX,
            homeY: homeY,
            state: 'healthy',
            hungerLevel: 0,
            fruitEaten: 0 // Track fruit eaten within current hunger level
        };
    }

    renderSprites() {
        const board = document.getElementById('game-board');
        
        // Clear existing sprites
        const existingSprites = board.querySelectorAll('.sprite');
        existingSprites.forEach(sprite => sprite.remove());
        
        // Render all sprites
        this.sprites.forEach(sprite => {
            const element = document.createElement('div');
            element.className = 'sprite';
            element.id = sprite.id;
            element.style.position = 'absolute';
            element.style.left = sprite.x + 'px';
            element.style.top = sprite.y + 'px';
            element.style.width = '20px';
            element.style.height = '20px';
            element.style.borderRadius = '50%';
            element.style.cursor = 'pointer';
            
            if (sprite.type === 'tree') {
                element.classList.add('tree');
                
                // Set background image based on fruit count
                if (sprite.fruitCount === 0) {
                    element.style.backgroundImage = 'url("tree-no-fruit-transparent.png")';
                } else if (sprite.fruitCount === 1) {
                    element.style.backgroundImage = 'url("tree-1-fruit-transparent.png")';
                } else {
                    element.style.backgroundImage = 'url("tree-2-fruit-transparent.png")';
                }
                
                element.title = `Tree (${sprite.fruitCount} fruit)`;
                element.addEventListener('click', () => this.harvestFruit(sprite));
            } else if (sprite.type === 'lalu') {
                element.title = `Lalu (${sprite.state})`;
                element.classList.add('lalu');
                
                // Add visual indicator for lalu state
                if (sprite.state === 'hungry') {
                    element.style.border = '2px solid #FFA500';
                } else if (sprite.state === 'starving') {
                    element.style.border = '2px solid #FF0000';
                } else if (sprite.state === 'dead') {
                    element.style.opacity = '0.5';
                    element.style.filter = 'grayscale(100%)';
                }
            }
            
            board.appendChild(element);
        });
    }

    harvestFruit(tree, specificLalu = null) {
        if (tree.fruitCount > 0) {
            tree.fruitCount--;
            
            // Feed specific lalu or the hungriest one
            let laluToFeed = specificLalu;
            if (!laluToFeed) {
                const hungryLalus = this.sprites
                    .filter(s => s.type === 'lalu' && s.state !== 'dead')
                    .sort((a, b) => b.hungerLevel - a.hungerLevel);
                laluToFeed = hungryLalus[0];
            }
            
            if (laluToFeed && laluToFeed.state !== 'dead') {
                laluToFeed.fruitEaten++;
                
                // Check if lalu has eaten enough fruit to reduce hunger level
                if (laluToFeed.fruitEaten >= 3) {
                    laluToFeed.hungerLevel = Math.max(0, laluToFeed.hungerLevel - 1);
                    laluToFeed.fruitEaten = 0; // Reset fruit counter
                    this.updateLaluState(laluToFeed);
                }
            }
            
            this.renderSprites();
        }
    }

    updateLaluState(lalu) {
        if (lalu.hungerLevel === 0) {
            lalu.state = 'healthy';
        } else if (lalu.hungerLevel === 1) {
            lalu.state = 'hungry';
        } else if (lalu.hungerLevel === 2) {
            lalu.state = 'starving';
        } else if (lalu.hungerLevel >= 3) {
            lalu.state = 'dead';
        }
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
        
        this.config.numTrees = numTrees;
        this.config.numLalus = numLalus;
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
        if (!sprite || sprite.state === 'dead') return;
        
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
        
        const spriteWidth = this.dragState.dragSprite.type === 'lalu' ? 50 : 80;
        const spriteHeight = this.dragState.dragSprite.type === 'lalu' ? 50 : 80;
        const newX = Math.max(0, Math.min(window.innerWidth - spriteWidth, coords.x - this.dragState.offsetX));
        const newY = Math.max(0, Math.min(window.innerHeight - spriteHeight, coords.y - this.dragState.offsetY));
        
        this.dragState.dragSprite.x = newX;
        this.dragState.dragSprite.y = newY;
        
        const element = document.getElementById(this.dragState.dragSprite.id);
        if (element) {
            element.style.left = newX + 'px';
            element.style.top = newY + 'px';
        }
        
        // Check for fruit tree intersections
        this.checkFruitIntersection(this.dragState.dragSprite);
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

    checkFruitIntersection(lalu) {
        const laluCenterX = lalu.x + 25; // 50px width / 2
        const laluCenterY = lalu.y + 25; // 50px height / 2
        
        this.sprites.forEach(sprite => {
            if (sprite.type === 'tree' && sprite.fruitCount > 0) {
                const treeCenterX = sprite.x + 40; // 80px width / 2
                const treeCenterY = sprite.y + 40; // 80px height / 2
                const distance = Math.sqrt(
                    Math.pow(laluCenterX - treeCenterX, 2) + 
                    Math.pow(laluCenterY - treeCenterY, 2)
                );
                
                // If sprites are touching (distance less than combined radii: lalu=25 + tree=40)
                if (distance < 65) {
                    this.harvestFruit(sprite, lalu);
                }
            }
        });
    }

    checkTreeRipeningIntersections(tree) {
        const treeCenterX = tree.x + 40; // 80px width / 2
        const treeCenterY = tree.y + 40; // 80px height / 2
        
        this.sprites.forEach(sprite => {
            if (sprite.type === 'lalu' && sprite.state !== 'dead') {
                const laluCenterX = sprite.x + 25;
                const laluCenterY = sprite.y + 25;
                const distance = Math.sqrt(
                    Math.pow(treeCenterX - laluCenterX, 2) + 
                    Math.pow(treeCenterY - laluCenterY, 2)
                );
                
                // If sprites are touching when tree grows fruit
                if (distance < 65) {
                    this.harvestFruit(tree, sprite);
                }
            }
        });
    }

    moveHungryLalus() {
        const fruitTrees = this.sprites.filter(s => s.type === 'tree' && s.fruitCount > 0);
        let needsRender = false;
        const moveSpeed = 3; // pixels per update

        this.sprites.forEach(lalu => {
            if (lalu.type === 'lalu' && lalu.state !== 'dead' && !this.dragState.isDragging) {
                
                let targetX, targetY;
                
                if (lalu.state === 'hungry' || lalu.state === 'starving') {
                    // Find nearest tree with fruit
                    let nearestTree = null;
                    let minDistance = Infinity;
                    
                    fruitTrees.forEach(tree => {
                        const distance = Math.sqrt(
                            Math.pow((lalu.x + 25) - (tree.x + 40), 2) + 
                            Math.pow((lalu.y + 25) - (tree.y + 40), 2)
                        );
                        if (distance < minDistance) {
                            minDistance = distance;
                            nearestTree = tree;
                        }
                    });

                    if (nearestTree && minDistance > 65) {
                        targetX = nearestTree.x + 40;
                        targetY = nearestTree.y + 40;
                    } else {
                        // No fruit trees or already at tree, head to home
                        targetX = lalu.homeX + 10;
                        targetY = lalu.homeY + 10;
                    }
                } else if (lalu.state === 'healthy') {
                    // Head towards home position
                    targetX = lalu.homeX + 25;
                    targetY = lalu.homeY + 25;
                }

                if (targetX !== undefined && targetY !== undefined) {
                    // Calculate direction vector
                    const dx = targetX - (lalu.x + 25);
                    const dy = targetY - (lalu.y + 25);
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Only move if not already at target
                    if (distance > 5) {
                        // Normalize and apply movement
                        const moveX = (dx / distance) * moveSpeed;
                        const moveY = (dy / distance) * moveSpeed;
                        
                        // Update position with bounds checking
                        lalu.x = Math.max(0, Math.min(window.innerWidth - 50, lalu.x + moveX));
                        lalu.y = Math.max(0, Math.min(window.innerHeight - 50, lalu.y + moveY));
                        
                        needsRender = true;
                    }
                    
                    // Check if lalu reached a tree
                    this.checkFruitIntersection(lalu);
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
            if (sprite.type === 'tree' && sprite.fruitCount < 2) {
                sprite.ripeTime -= 100;
                if (sprite.ripeTime <= 0) {
                    sprite.fruitCount++;
                    sprite.ripeTime = Math.random() * 10000; // Reset for next fruit growth
                    needsRender = true;
                    
                    // Check if any lalu is touching this tree when fruit grows
                    this.checkTreeRipeningIntersections(sprite);
                }
            }
        });

        // Move hungry lalus towards nearest ripe tree
        this.moveHungryLalus();

        // Update day progress bar
        this.updateDayTicker();

        if (needsRender) {
            this.renderSprites();
        }
    }

    processDayEnd() {
        // Increase hunger for all living lalus
        this.sprites.forEach(sprite => {
            if (sprite.type === 'lalu' && sprite.state !== 'dead') {
                sprite.hungerLevel++;
                this.updateLaluState(sprite);
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
