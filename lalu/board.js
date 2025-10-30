class GameBoard {
    constructor() {
        this.sprites = [];
        this.config = this.loadConfig();
        this.lastDayUpdate = Date.now();
        this.setupBoard();
        this.generateSprites();
        this.setupModal();
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
            x: Math.random() * (window.innerWidth - 20),
            y: Math.random() * (window.innerHeight - 20),
            state: 'unripe',
            ripeTime: Math.random() * 24 * 60 * 60 * 1000 // Random time within 24 hours
        };
    }

    createLalu() {
        return {
            id: 'lalu_' + Math.random().toString(36).substr(2, 9),
            type: 'lalu',
            x: Math.random() * (window.innerWidth - 20),
            y: Math.random() * (window.innerHeight - 20),
            state: 'healthy',
            hungerLevel: 0
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
                element.style.backgroundColor = sprite.state === 'ripe' ? '#FF4444' : '#44AA44';
                element.title = `Tree (${sprite.state})`;
                element.addEventListener('click', () => this.harvestFruit(sprite));
            } else if (sprite.type === 'lalu') {
                element.style.backgroundColor = '#FFB366';
                element.title = `Lalu (${sprite.state})`;
                
                // Add visual indicator for lalu state
                if (sprite.state === 'hungry') {
                    element.style.border = '2px solid #FFA500';
                } else if (sprite.state === 'starving') {
                    element.style.border = '2px solid #FF0000';
                } else if (sprite.state === 'dead') {
                    element.style.backgroundColor = '#666666';
                    element.style.opacity = '0.5';
                }
            }
            
            board.appendChild(element);
        });
    }

    harvestFruit(tree) {
        if (tree.state === 'ripe') {
            tree.state = 'unripe';
            tree.ripeTime = Math.random() * 24 * 60 * 60 * 1000;
            
            // Feed the hungriest lalu
            const hungryLalus = this.sprites
                .filter(s => s.type === 'lalu' && s.state !== 'dead')
                .sort((a, b) => b.hungerLevel - a.hungerLevel);
            
            if (hungryLalus.length > 0) {
                const lalu = hungryLalus[0];
                lalu.hungerLevel = Math.max(0, lalu.hungerLevel - 1);
                this.updateLaluState(lalu);
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

        // Update tree ripening
        this.sprites.forEach(sprite => {
            if (sprite.type === 'tree' && sprite.state === 'unripe') {
                sprite.ripeTime -= 100;
                if (sprite.ripeTime <= 0) {
                    sprite.state = 'ripe';
                    sprite.ripeTime = Math.random() * 24 * 60 * 60 * 1000;
                    needsRender = true;
                }
            }
        });

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
