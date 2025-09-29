// Game State
let socket = null;
let gameState = {
    roomId: null,
    playerId: null,
    players: [],
    currentPlayer: 0,
    gameStarted: false,
    board: {},
    diceValue: 1,
    canRoll: false
};

// Initialize the game
document.addEventListener('DOMContentLoaded', function() {
    connectToServer();
    initializeGame();
});

// Server Connection
function connectToServer() {
    // Use our deployed server
    const serverUrl = 'https://ludo-multiplayer-server.onrender.com'; // Will deploy here

    console.log('Connecting to server...');

    socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 8000,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
    });

    // Fallback timer
    const fallbackTimer = setTimeout(() => {
        console.log('Connection timeout - using offline mode');
        updateConnectionStatus(false);
        showToast('Server timeout. Using offline mode.', 'info');
        socket = null;
    }, 8000);

    socket.on('connect', () => {
        clearTimeout(fallbackTimer);
        console.log('✅ Connected to server!');
        updateConnectionStatus(true);
        showToast('🟢 Connected! Online multiplayer ready!', 'success');
        setupSocketEvents();
    });

    socket.on('connect_error', (error) => {
        clearTimeout(fallbackTimer);
        console.error('Connection failed:', error);
        updateConnectionStatus(false);
        showToast('Connection failed. Using offline mode.', 'info');
        socket = null;
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
        showToast('Disconnected from server', 'info');
    });
}

function setupSocketEvents() {
    if (!socket) return;

    socket.on('roomCreated', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerId = data.playerId;
        gameState.players = data.players;
        showLobby();
        updateLobby();
        showToast(`Room ${data.roomId} created!`, 'success');
    });

    socket.on('roomJoined', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerId = data.playerId;
        gameState.players = data.players;
        showLobby();
        updateLobby();
        showToast(`Joined room ${data.roomId}!`, 'success');
    });

    socket.on('playerJoined', (data) => {
        gameState.players = data.players;
        updateLobby();
        showToast(`${data.playerName} joined!`, 'info');
    });

    socket.on('playerLeft', (data) => {
        gameState.players = data.players;
        updateLobby();
        showToast(`${data.playerName} left`, 'info');
    });

    socket.on('gameStarted', (data) => {
        gameState.gameStarted = true;
        gameState.currentPlayer = data.currentPlayer;
        showGame();
        updateGameState();
        showToast('🎮 Game Started!', 'success');
    });

    socket.on('diceRolled', (data) => {
        gameState.diceValue = data.value;
        gameState.currentPlayer = data.currentPlayer;
        updateDice(data.value);
        updateTurn();
        showToast(`${data.playerName} rolled ${data.value}`, 'info');
    });

    socket.on('pieceMoved', (data) => {
        updateBoard(data);
        showToast(`${data.playerName} moved a piece`, 'info');
    });

    socket.on('error', (data) => {
        showToast(data.message, 'error');
    });
}

// Screen Management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function showHome() {
    showScreen('homeScreen');
}

function showCreateRoom() {
    showScreen('createRoomScreen');
}

function showJoinRoom() {
    showScreen('joinRoomScreen');
}

function showLobby() {
    showScreen('lobbyScreen');
    document.getElementById('roomId').textContent = gameState.roomId;
}

function showGame() {
    showScreen('gameScreen');
    document.getElementById('gameRoomId').textContent = gameState.roomId;
    document.getElementById('gamePlayersCount').textContent = gameState.players.length;
    initializeBoard();
}

function showLoading(text = 'Loading...') {
    document.getElementById('loadingText').textContent = text;
    showScreen('loadingScreen');
}

// Room Management
function createRoom() {
    const playerName = document.getElementById('playerName1').value.trim();
    if (!playerName) {
        showToast('Please enter your name', 'error');
        return;
    }

    if (!socket || !socket.connected) {
        showToast('Not connected to server. Using offline mode.', 'error');
        // Create local room for testing
        createLocalRoom(playerName);
        return;
    }

    showLoading('Creating room...');
    socket.emit('createRoom', { playerName: playerName });

    // Timeout after 10 seconds
    setTimeout(() => {
        if (!gameState.roomId) {
            showToast('Server timeout. Creating local room...', 'error');
            createLocalRoom(playerName);
        }
    }, 10000);
}

function createLocalRoom(playerName) {
    // Create a local room that works offline
    gameState.roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    gameState.playerId = 'local-' + Date.now();
    gameState.players = [{ id: gameState.playerId, name: playerName }];

    // Add a bot player automatically for demo
    setTimeout(() => {
        addBotPlayer();
        showLobby();
        updateLobby();
        showToast('Local room created! Added bot player for demo.', 'success');
    }, 500);
}

function addBotPlayer() {
    const botNames = ['Robot Player', 'AI Challenger', 'Bot Buddy', 'Computer'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];

    gameState.players.push({
        id: 'bot-' + Date.now(),
        name: botName,
        isBot: true
    });
}

function joinRoom() {
    const playerName = document.getElementById('playerName2').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim();

    if (!playerName || !roomCode) {
        showToast('Please enter your name and room code', 'error');
        return;
    }

    if (!socket || !socket.connected) {
        showToast('Not connected to server. Cannot join room.', 'error');
        showHome();
        return;
    }

    showLoading('Joining room...');
    socket.emit('joinRoom', { roomId: roomCode, playerName: playerName });

    // Timeout after 10 seconds
    setTimeout(() => {
        if (!gameState.roomId) {
            showToast('Failed to join room. Try again.', 'error');
            showJoinRoom();
        }
    }, 10000);
}

function leaveRoom() {
    socket.emit('leaveRoom', { roomId: gameState.roomId, playerId: gameState.playerId });
    resetGameState();
    showHome();
}

function leaveGame() {
    leaveRoom();
}

// Game Management
function startGame() {
    if (socket && socket.connected) {
        socket.emit('startGame', { roomId: gameState.roomId, playerId: gameState.playerId });
    } else {
        // Local game start
        gameState.gameStarted = true;
        gameState.currentPlayer = 0;
        gameState.canRoll = true;
        showGame();
        updateGameState();
        showToast('Local game started! 🎮', 'success');
    }
}

function rollDice() {
    if (!gameState.canRoll) {
        showToast('Not your turn!', 'error');
        return;
    }

    const dice = document.getElementById('dice');
    dice.classList.add('rolling');

    setTimeout(() => {
        dice.classList.remove('rolling');

        if (socket && socket.connected) {
            socket.emit('rollDice', { roomId: gameState.roomId, playerId: gameState.playerId });
        } else {
            // Local dice roll
            const diceValue = Math.floor(Math.random() * 6) + 1;
            updateDice(diceValue);

            showToast(`You rolled ${diceValue}!`, 'info');

            // Move to next player if not 6
            if (diceValue !== 6) {
                gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
                updateTurn();

                // Bot turn simulation
                if (gameState.players[gameState.currentPlayer].isBot) {
                    setTimeout(() => {
                        botTurn();
                    }, 2000);
                }
            }
        }
    }, 500);
}

function botTurn() {
    const botDice = Math.floor(Math.random() * 6) + 1;
    updateDice(botDice);

    const botName = gameState.players[gameState.currentPlayer].name;
    showToast(`${botName} rolled ${botDice}`, 'info');

    setTimeout(() => {
        if (botDice !== 6) {
            gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
            updateTurn();

            if (gameState.players[gameState.currentPlayer].isBot) {
                setTimeout(() => botTurn(), 2000);
            }
        } else {
            // Bot gets another turn
            setTimeout(() => botTurn(), 1500);
        }
    }, 1000);
}

// UI Updates
function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (connected) {
        status.textContent = '🟢 Connected to server - Online multiplayer available';
        status.className = 'connection-status connected';
    } else {
        status.textContent = '🟠 Offline mode - Local games only';
        status.className = 'connection-status disconnected';
    }
}

function updateLobby() {
    const playersList = document.getElementById('playersList');
    const startBtn = document.getElementById('startGameBtn');
    const waitingMsg = document.getElementById('waitingMessage');

    playersList.innerHTML = '';

    gameState.players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';

        const colorDiv = document.createElement('div');
        colorDiv.className = 'player-color';
        const colors = ['#f44336', '#FFC107', '#2196F3', '#4CAF50'];
        colorDiv.style.backgroundColor = colors[index % 4];

        const nameDiv = document.createElement('div');
        nameDiv.textContent = player.name;

        playerDiv.appendChild(colorDiv);
        playerDiv.appendChild(nameDiv);
        playersList.appendChild(playerDiv);
    });

    if (gameState.players.length >= 2) {
        startBtn.classList.remove('hidden');
        waitingMsg.style.display = 'none';
    } else {
        startBtn.classList.add('hidden');
        waitingMsg.style.display = 'block';
    }
}

function updateGameState() {
    document.getElementById('gamePlayersCount').textContent = gameState.players.length;
    updateTurn();
}

function updateTurn() {
    const currentPlayer = gameState.players[gameState.currentPlayer];
    document.getElementById('currentTurn').textContent = currentPlayer ? currentPlayer.name : 'Unknown';

    const turnIndicator = document.getElementById('turnIndicator');
    const isMyTurn = gameState.currentPlayer === gameState.players.findIndex(p => p.id === gameState.playerId);

    if (isMyTurn) {
        turnIndicator.textContent = 'Your Turn!';
        turnIndicator.className = 'turn-indicator';
        gameState.canRoll = true;
    } else {
        turnIndicator.textContent = `${currentPlayer ? currentPlayer.name : 'Player'}'s Turn`;
        turnIndicator.className = 'turn-indicator not-turn';
        gameState.canRoll = false;
    }
}

function updateDice(value) {
    const diceElement = document.getElementById('dice').querySelector('.dice-face');
    diceElement.textContent = value;
    gameState.diceValue = value;
}

function updateBoard(data) {
    // Update board based on server data
    // This would handle piece movements on the board
    console.log('Board updated:', data);
}

// Board Initialization
function initializeBoard() {
    // Initialize all pieces in home positions
    const pieces = document.querySelectorAll('.piece');
    pieces.forEach(piece => {
        piece.addEventListener('click', handlePieceClick);
    });

    // Set initial dice
    updateDice(1);
    updateTurn();
}

function handlePieceClick(event) {
    if (!gameState.canRoll) {
        showToast('Not your turn!', 'error');
        return;
    }

    const piece = event.target;
    const playerId = parseInt(piece.dataset.player);
    const pieceId = parseInt(piece.dataset.piece);

    // Check if this piece belongs to current player
    const currentPlayerIndex = gameState.players.findIndex(p => p.id === gameState.playerId);
    if (playerId !== currentPlayerIndex) {
        showToast('That\'s not your piece!', 'error');
        return;
    }

    // Emit move piece event
    socket.emit('movePiece', {
        roomId: gameState.roomId,
        playerId: gameState.playerId,
        pieceId: pieceId
    });
}

// Utility Functions
function resetGameState() {
    gameState = {
        roomId: null,
        playerId: null,
        players: [],
        currentPlayer: 0,
        gameStarted: false,
        board: {},
        diceValue: 1,
        canRoll: false
    };
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function initializeGame() {
    // Set up initial game state
    showHome();

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && gameState.gameStarted && gameState.canRoll) {
            e.preventDefault();
            rollDice();
        }
    });
}

// PWA Support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}