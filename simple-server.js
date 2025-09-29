// Simple Socket.io server for Ludo game
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Enable CORS for all origins
app.use(cors());

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store game rooms
const rooms = new Map();

app.get('/', (req, res) => {
    res.json({
        status: 'Server running',
        message: 'Ludo Game Socket.io Server',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('createRoom', (data) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const player = {
            id: socket.id,
            name: data.playerName,
            socketId: socket.id
        };

        const room = {
            id: roomId,
            players: [player],
            gameStarted: false,
            currentPlayer: 0,
            host: socket.id
        };

        rooms.set(roomId, room);
        socket.join(roomId);

        socket.emit('roomCreated', {
            roomId: roomId,
            playerId: socket.id,
            players: room.players.map(p => ({ id: p.id, name: p.name }))
        });

        console.log(`Room ${roomId} created by ${data.playerName}`);
    });

    socket.on('joinRoom', (data) => {
        const room = rooms.get(data.roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.players.length >= 4) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        const player = {
            id: socket.id,
            name: data.playerName,
            socketId: socket.id
        };

        room.players.push(player);
        socket.join(data.roomId);

        socket.emit('roomJoined', {
            roomId: data.roomId,
            playerId: socket.id,
            players: room.players.map(p => ({ id: p.id, name: p.name }))
        });

        socket.to(data.roomId).emit('playerJoined', {
            players: room.players.map(p => ({ id: p.id, name: p.name })),
            playerName: data.playerName
        });

        console.log(`${data.playerName} joined room ${data.roomId}`);
    });

    socket.on('startGame', (data) => {
        const room = rooms.get(data.roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.host !== socket.id) {
            socket.emit('error', { message: 'Only host can start game' });
            return;
        }

        if (room.players.length < 2) {
            socket.emit('error', { message: 'Need at least 2 players' });
            return;
        }

        room.gameStarted = true;
        room.currentPlayer = 0;

        io.to(data.roomId).emit('gameStarted', {
            currentPlayer: room.currentPlayer,
            players: room.players.map(p => ({ id: p.id, name: p.name }))
        });

        console.log(`Game started in room ${data.roomId}`);
    });

    socket.on('rollDice', (data) => {
        const room = rooms.get(data.roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const currentPlayerIndex = room.players.findIndex(p => p.id === socket.id);
        if (currentPlayerIndex !== room.currentPlayer) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        const diceValue = Math.floor(Math.random() * 6) + 1;

        // Move to next player if dice is not 6
        if (diceValue !== 6) {
            room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
        }

        io.to(data.roomId).emit('diceRolled', {
            value: diceValue,
            playerId: socket.id,
            playerName: room.players[currentPlayerIndex].name,
            currentPlayer: room.currentPlayer
        });

        console.log(`Player ${room.players[currentPlayerIndex].name} rolled ${diceValue}`);
    });

    socket.on('movePiece', (data) => {
        const room = rooms.get(data.roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        socket.to(data.roomId).emit('pieceMoved', {
            playerId: socket.id,
            pieceId: data.pieceId,
            playerName: room.players.find(p => p.id === socket.id)?.name
        });

        console.log(`Piece moved by ${socket.id}`);
    });

    socket.on('leaveRoom', (data) => {
        const room = rooms.get(data.roomId);

        if (room) {
            room.players = room.players.filter(p => p.id !== socket.id);
            socket.leave(data.roomId);

            if (room.players.length === 0) {
                rooms.delete(data.roomId);
                console.log(`Room ${data.roomId} deleted`);
            } else {
                // If host left, make first player new host
                if (room.host === socket.id) {
                    room.host = room.players[0].id;
                }

                socket.to(data.roomId).emit('playerLeft', {
                    players: room.players.map(p => ({ id: p.id, name: p.name })),
                    playerName: 'A player'
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        // Remove player from all rooms
        for (const [roomId, room] of rooms) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);

                if (room.players.length === 0) {
                    rooms.delete(roomId);
                } else {
                    if (room.host === socket.id) {
                        room.host = room.players[0].id;
                    }

                    socket.to(roomId).emit('playerLeft', {
                        players: room.players.map(p => ({ id: p.id, name: p.name })),
                        playerName: 'A player'
                    });
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Ludo game server running on port ${PORT}`);
    console.log(`Access at: http://localhost:${PORT}`);
});