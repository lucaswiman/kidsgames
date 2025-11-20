// Bertymon - A Pokemon-inspired adventure game for Berty!
// Initialize KAPLAY
kaplay({
    width: 800,
    height: 600,
    background: [135, 206, 235], // Sky blue
    crisp: true,
});

// Load sprites
loadSprite("player", "data:image/svg+xml;base64," + btoa(`
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="#ff6b6b"/>
        <rect x="8" y="8" width="16" height="16" fill="#4ecdc4"/>
        <circle cx="16" cy="12" r="2" fill="white"/>
    </svg>
`));

// Load Bertymon sprites
loadSprite("aquawing", "sprites/Aquawing.png");
loadSprite("flarepup", "sprites/Flarepup.png");
loadSprite("treebeast", "sprites/Treebeast.png");

loadSprite("professor", "data:image/svg+xml;base64," + btoa(`
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="#95a5a6"/>
        <rect x="6" y="6" width="20" height="20" fill="#f39c12"/>
        <circle cx="16" cy="14" r="3" fill="white"/>
        <rect x="12" y="20" width="8" height="4" fill="#e74c3c"/>
    </svg>
`));

loadSprite("lab", "data:image/svg+xml;base64," + btoa(`
    <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" fill="#8e44ad"/>
        <rect x="8" y="8" width="48" height="48" fill="#9b59b6"/>
        <rect x="24" y="32" width="16" height="24" fill="#34495e"/>
        <rect x="16" y="16" width="12" height="12" fill="#f1c40f"/>
        <rect x="36" y="16" width="12" height="12" fill="#f1c40f"/>
    </svg>
`));

loadSprite("grass", "data:image/svg+xml;base64," + btoa(`
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" fill="#27ae60"/>
        <rect x="4" y="4" width="24" height="24" fill="#2ecc71"/>
    </svg>
`));

// Game state
let gameState = {
    playerName: "Berty",
    hasStarterBertymon: false,
    currentScene: "intro"
};

// Intro scene
scene("intro", () => {
    // Create grass background
    for (let x = 0; x < width() / 32; x++) {
        for (let y = 0; y < height() / 32; y++) {
            add([
                sprite("grass"),
                pos(x * 32, y * 32),
                "grass"
            ]);
        }
    }

    // Add professor's lab
    const lab = add([
        sprite("lab"),
        pos(width() / 2 - 32, 100),
        area(),
        "lab",
        "interactable"
    ]);

    // Add professor near the lab
    const professor = add([
        sprite("professor"),
        pos(width() / 2, 180),
        area(),
        "professor",
        "interactable"
    ]);

    // Add player
    const player = add([
        sprite("player"),
        pos(width() / 2, height() - 100),
        area(),
        body(),
        "player"
    ]);

    // Player movement
    const SPEED = 120;
    
    onKeyDown("left", () => {
        player.move(-SPEED, 0);
    });
    
    onKeyDown("right", () => {
        player.move(SPEED, 0);
    });
    
    onKeyDown("up", () => {
        player.move(0, -SPEED);
    });
    
    onKeyDown("down", () => {
        player.move(0, SPEED);
    });

    // Keep player in bounds
    player.onUpdate(() => {
        if (player.pos.x < 0) player.pos.x = 0;
        if (player.pos.x > width() - 32) player.pos.x = width() - 32;
        if (player.pos.y < 0) player.pos.y = 0;
        if (player.pos.y > height() - 32) player.pos.y = height() - 32;
    });

    // Interaction system
    onKeyPress("space", () => {
        // Check if player is near any interactable object
        const interactables = get("interactable");
        
        interactables.forEach(obj => {
            const distance = player.pos.dist(obj.pos);
            if (distance < 60) {
                if (obj.is("professor")) {
                    showProfessorDialog();
                } else if (obj.is("lab")) {
                    enterLab();
                }
            }
        });
    });

    // UI Text
    add([
        text("Welcome to the world of Bertymon!", {
            size: 24,
            font: "monospace"
        }),
        pos(width() / 2, 30),
        anchor("center"),
        color(255, 255, 255),
        outline(2, rgb(0, 0, 0))
    ]);

    add([
        text("Use arrow keys to move, SPACE to interact", {
            size: 16,
            font: "monospace"
        }),
        pos(width() / 2, height() - 30),
        anchor("center"),
        color(255, 255, 255),
        outline(1, rgb(0, 0, 0))
    ]);

    // Dialog functions
    function showProfessorDialog() {
        add([
            rect(width() - 40, 120),
            pos(20, height() - 140),
            color(255, 255, 255),
            outline(2, rgb(0, 0, 0)),
            "dialog"
        ]);

        add([
            text("Professor Willow: Hello there, " + gameState.playerName + "!\nWelcome to the world of Bertymon!\nHead to my lab to choose your first companion!", {
                size: 14,
                font: "monospace",
                width: width() - 80
            }),
            pos(40, height() - 120),
            color(0, 0, 0),
            "dialog"
        ]);

        // Auto-close dialog after 4 seconds
        wait(4, () => {
            destroyAll("dialog");
        });
    }

    function enterLab() {
        go("lab");
    }
});

// Lab scene
scene("lab", () => {
    add([
        rect(width(), height()),
        pos(0, 0),
        color(139, 69, 19) // Brown floor
    ]);

    // Lab equipment (simple rectangles for now)
    add([
        rect(100, 60),
        pos(50, 100),
        color(192, 192, 192),
        "equipment"
    ]);

    add([
        rect(100, 60),
        pos(width() - 150, 100),
        color(192, 192, 192),
        "equipment"
    ]);

    // Three starter Bertymon
    const starters = [
        { name: "Flarepup", sprite: "flarepup", type: "Fire" },
        { name: "Aquawing", sprite: "aquawing", type: "Water" },
        { name: "Treebeast", sprite: "treebeast", type: "Grass" }
    ];

    starters.forEach((starter, i) => {
        add([
            sprite(starter.sprite),
            pos(width() / 2 - 120 + i * 120, height() / 2),
            anchor("center"), // Center the sprite
            scale(1.0), // Make sprites 200% bigger
            area(),
            "starter",
            { starterData: starter }
        ]);

        add([
            text(starter.name, {
                size: 12,
                font: "monospace"
            }),
            pos(width() / 2 - 120 + i * 120, height() / 2 + 50),
            anchor("center"),
            color(255, 255, 255),
            outline(1, rgb(0, 0, 0))
        ]);
    });

    // Add player in lab
    const player = add([
        sprite("player"),
        pos(width() / 2, height() - 80),
        area(),
        body(),
        "player"
    ]);

    // Player movement (same as intro)
    const SPEED = 120;
    
    onKeyDown("left", () => {
        player.move(-SPEED, 0);
    });
    
    onKeyDown("right", () => {
        player.move(SPEED, 0);
    });
    
    onKeyDown("up", () => {
        player.move(0, -SPEED);
    });
    
    onKeyDown("down", () => {
        player.move(0, SPEED);
    });

    // Keep player in bounds
    player.onUpdate(() => {
        if (player.pos.x < 16) player.pos.x = 16;
        if (player.pos.x > width() - 48) player.pos.x = width() - 48;
        if (player.pos.y < 16) player.pos.y = 16;
        if (player.pos.y > height() - 48) player.pos.y = height() - 48;
    });

    // Starter selection
    onKeyPress("space", () => {
        const starters = get("starter");
        
        starters.forEach(starter => {
            const distance = player.pos.dist(starter.pos);
            if (distance < 50) {
                selectStarter(starter.starterData);
            }
        });
    });

    function selectStarter(starterData) {
        gameState.hasStarterBertymon = true;
        gameState.starterBertymon = starterData;

        // Show selection dialog
        add([
            rect(width() - 40, 100),
            pos(20, 20),
            color(255, 255, 255),
            outline(2, rgb(0, 0, 0)),
            "dialog"
        ]);

        add([
            text(`Congratulations! You chose ${starterData.name}!\nYour adventure begins now!`, {
                size: 16,
                font: "monospace",
                width: width() - 80
            }),
            pos(40, 40),
            color(0, 0, 0),
            "dialog"
        ]);

        wait(3, () => {
            destroyAll("dialog");
            // Could transition to overworld or battle scene here
            add([
                text("Game scaffolding complete!\nMore features coming soon...", {
                    size: 20,
                    font: "monospace"
                }),
                pos(width() / 2, height() / 2 + 100),
                anchor("center"),
                color(255, 255, 0),
                outline(2, rgb(0, 0, 0))
            ]);
        });
    }

    // UI
    add([
        text("Professor's Lab - Choose Your Starter Bertymon!", {
            size: 20,
            font: "monospace"
        }),
        pos(width() / 2, 30),
        anchor("center"),
        color(255, 255, 255),
        outline(2, rgb(0, 0, 0))
    ]);

    add([
        text("Walk up to a Bertymon and press SPACE to choose", {
            size: 14,
            font: "monospace"
        }),
        pos(width() / 2, height() - 30),
        anchor("center"),
        color(255, 255, 255),
        outline(1, rgb(0, 0, 0))
    ]);
});

// Start the game
go("intro");
