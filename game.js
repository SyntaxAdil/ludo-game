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
    const serverUrl = 'https://ludo-n12co9hlr-adils-projects-ab51230d.vercel.app';
    socket = io(serverUrl);

    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
    });

    socket.on('roomCreated', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerId = data.playerId;
        gameState.players = data.players;
        showLobby();
        updateLobby();
    });

    socket.on('roomJoined', (data) => {
        gameState.roomId = data.roomId;
        gameState.playerId = data.playerId;
        gameState.players = data.players;
        showLobby();
        updateLobby();
    });

    socket.on('playerJoined', (data) => {
        gameState.players = data.players;
        updateLobby();
        showToast(`${data.playerName} joined the room!`);
    });

    socket.on('playerLeft', (data) => {
        gameState.players = data.players;
        updateLobby();
        showToast(`${data.playerName} left the room`);
    });

    socket.on('gameStarted', (data) => {
        gameState.gameStarted = true;
        gameState.currentPlayer = data.currentPlayer;
        showGame();
        updateGameState();
        showToast('Game Started!');
    });

    socket.on('diceRolled', (data) => {
        gameState.diceValue = data.value;
        gameState.currentPlayer = data.currentPlayer;
        gameState.canRoll = data.playerId === gameState.playerId;
        updateDice(data.value);
        updateTurn();
        showToast(`${data.playerName} rolled ${data.value}`);
    });

    socket.on('pieceMoved', (data) => {
        updateBoard(data);
        showToast(`${data.playerName} moved a piece`);
    });

    socket.on('gameWon', (data) => {
        showToast(`🎉 ${data.winnerName} wins the game! 🎉`);
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

    showLoading('Creating room...');
    socket.emit('createRoom', { playerName: playerName });
}

function joinRoom() {
    const playerName = document.getElementById('playerName2').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim();

    if (!playerName || !roomCode) {
        showToast('Please enter your name and room code', 'error');
        return;
    }

    showLoading('Joining room...');
    socket.emit('joinRoom', { roomId: roomCode, playerName: playerName });
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
    socket.emit('startGame', { roomId: gameState.roomId, playerId: gameState.playerId });
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
        socket.emit('rollDice', { roomId: gameState.roomId, playerId: gameState.playerId });
    }, 500);
}

// UI Updates
function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (connected) {
        status.textContent = '🟢 Connected to server';
        status.className = 'connection-status connected';
    } else {
        status.textContent = '🔴 Disconnected from server';
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