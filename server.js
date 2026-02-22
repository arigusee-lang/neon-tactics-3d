import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  }
});

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/health', (req, res) => res.sendStatus(200));

// Catch-all for SPA
app.use((req, res, next) => {
  // Skip if it feels like an API request or socket.io (though socket.io is handled by http server directly usually, but express middleware might see it)
  if (req.path.startsWith('/socket.io/')) return next();

  // If it's a GET request and accepts HTML, send index.html
  if (req.method === 'GET' && req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    next();
  }
});

// Game state in memory (for server-authoritative logic later)
let gameState = {
  // ... initial state
};

// Lobby management
const lobbies = {}; // { roomId: { players: [socketId], mapId: string } }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Create Lobby
  socket.on('create_lobby', (payload = {}) => {
    const mapId = typeof payload?.mapId === 'string' ? payload.mapId : 'MAP_1';
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    lobbies[roomId] = {
      players: [socket.id],
      gameState: null,
      mapId
    };
    socket.join(roomId);
    socket.emit('lobby_created', { roomId, mapId });
    console.log(`Lobby created: ${roomId} by ${socket.id} | map=${mapId}`);
  });

  // 2. Join Lobby
  socket.on('join_lobby', (roomId) => {
    const lobby = lobbies[roomId];
    if (lobby && lobby.players.length < 2) {
      lobby.players.push(socket.id);
      socket.join(roomId);

      // Notify both players that game is ready
      io.to(roomId).emit('game_start', {
        roomId,
        players: lobby.players,
        mapId: lobby.mapId || 'MAP_1'
      });
      console.log(`Player ${socket.id} joined lobby ${roomId}`);
    } else {
      socket.emit('error_message', 'Lobby not found or full');
    }
  });

  // 3. Game Actions Relay
  // We simply relay the action to the OTHER player in the room.
  socket.on('game_action', (payload) => {
    // payload should contain { roomId, action, data }
    if (payload.roomId) {
      socket.to(payload.roomId).emit('game_action', payload);
      // console.log(`Action forwarded in ${payload.roomId}:`, payload.action);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Ideally cleanup empty lobbies or notify opponent
    // For now, simplicity first
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
