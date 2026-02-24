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
const lobbies = {}; // { roomId: { players: [socketId], mapId: string, currentTurn: 'P1'|'P2', started: boolean } }

const PLAYER_ONE = 'P1';
const PLAYER_TWO = 'P2';

const AUTHORITATIVE_ACTIONS = new Set([
  'SYNC_STATE',
  'MOVE',
  'ATTACK',
  'SKIP_TURN',
  'TELEPORT',
  'PLACE_UNIT',
  'ION_CANNON_STRIKE',
  'FORWARD_BASE_PLACE',
  'FREEZE_TARGET',
  'HEAL_TARGET',
  'RESTORE_ENERGY_TARGET',
  'MIND_CONTROL_TARGET',
  'MIND_CONTROL_BREAK',
  'SUMMON_ACTIVATE',
  'SUMMON_PLACE',
  'WALL_CHAIN_PLACE',
  'CHARACTER_ACTION_TRIGGER',
  'SUICIDE_PROTOCOL',
  'DRONE_DETONATE',
  'SHOP_BUY',
  'SHOP_REFUND',
  'SHOP_REROLL',
  'TALENT_SELECTION_START',
  'TALENT_CHOOSE'
]);

const TURN_GATED_ACTIONS = new Set([
  'SYNC_STATE',
  'MOVE',
  'ATTACK',
  'SKIP_TURN',
  'TELEPORT',
  'PLACE_UNIT',
  'ION_CANNON_STRIKE',
  'FORWARD_BASE_PLACE',
  'FREEZE_TARGET',
  'HEAL_TARGET',
  'RESTORE_ENERGY_TARGET',
  'MIND_CONTROL_TARGET',
  'MIND_CONTROL_BREAK',
  'SUMMON_ACTIVATE',
  'SUMMON_PLACE',
  'WALL_CHAIN_PLACE',
  'CHARACTER_ACTION_TRIGGER',
  'SUICIDE_PROTOCOL',
  'DRONE_DETONATE',
  'SHOP_BUY',
  'SHOP_REFUND',
  'SHOP_REROLL',
  'TALENT_SELECTION_START',
  'TALENT_CHOOSE'
]);

const ACTIONS_WITH_EXPLICIT_PLAYER = new Set([
  'PLACE_UNIT',
  'ION_CANNON_STRIKE',
  'FORWARD_BASE_PLACE',
  'SUICIDE_PROTOCOL',
  'DRONE_DETONATE',
  'SHOP_BUY',
  'SHOP_REFUND',
  'SHOP_REROLL',
  'TALENT_SELECTION_START',
  'TALENT_CHOOSE'
]);

function getPlayerIdForSocket(lobby, socketId) {
  const index = lobby.players.indexOf(socketId);
  if (index === 0) return PLAYER_ONE;
  if (index === 1) return PLAYER_TWO;
  return null;
}

function getNextTurn(currentTurn) {
  return currentTurn === PLAYER_ONE ? PLAYER_TWO : PLAYER_ONE;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // 1. Create Lobby
  socket.on('create_lobby', (payload = {}) => {
    const mapId = typeof payload?.mapId === 'string' ? payload.mapId : 'MAP_1';
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    lobbies[roomId] = {
      players: [socket.id],
      gameState: null,
      mapId,
      currentTurn: PLAYER_ONE,
      started: false
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
      lobby.started = true;
      lobby.currentTurn = PLAYER_ONE;
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

  // 3. Authoritative Command Channel (initial vertical slice)
  socket.on('authoritative_command_request', (payload = {}) => {
    const { roomId, action } = payload;
    let data = payload.data;
    if (!roomId || typeof action !== 'string') {
      socket.emit('command_rejected', { action: action || 'UNKNOWN', reason: 'INVALID_PAYLOAD' });
      return;
    }

    if (!AUTHORITATIVE_ACTIONS.has(action)) {
      socket.emit('command_rejected', { action, reason: 'UNSUPPORTED_ACTION' });
      return;
    }

    const lobby = lobbies[roomId];
    if (!lobby) {
      socket.emit('command_rejected', { action, reason: 'ROOM_NOT_FOUND' });
      return;
    }

    if (!lobby.players.includes(socket.id)) {
      socket.emit('command_rejected', { action, reason: 'NOT_IN_ROOM' });
      return;
    }

    if (!lobby.started) {
      socket.emit('command_rejected', { action, reason: 'GAME_NOT_STARTED' });
      return;
    }

    const actorPlayerId = getPlayerIdForSocket(lobby, socket.id);
    if (!actorPlayerId) {
      socket.emit('command_rejected', { action, reason: 'PLAYER_ID_UNRESOLVED' });
      return;
    }

    if (TURN_GATED_ACTIONS.has(action) && actorPlayerId !== lobby.currentTurn) {
      socket.emit('command_rejected', { action, reason: 'NOT_YOUR_TURN' });
      return;
    }

    if (ACTIONS_WITH_EXPLICIT_PLAYER.has(action)) {
      const payloadPlayer = data?.playerId;
      if (payloadPlayer && payloadPlayer !== actorPlayerId) {
        socket.emit('command_rejected', { action, reason: 'PLAYER_MISMATCH' });
        return;
      }
      data = { ...(data || {}), playerId: actorPlayerId };
    }

    const turnBefore = lobby.currentTurn;
    if (action === 'SKIP_TURN') {
      lobby.currentTurn = getNextTurn(lobby.currentTurn);
    }

    io.to(roomId).emit('authoritative_command', {
      action,
      data,
      meta: {
        actorPlayerId,
        turnBefore,
        turnAfter: lobby.currentTurn,
        timestamp: Date.now()
      }
    });
  });

  // 3. Game Actions Relay
  // We simply relay the action to the OTHER player in the room.
  socket.on('game_action', (payload = {}) => {
    // payload should contain { roomId, action, data }
    if (payload.roomId && lobbies[payload.roomId] && lobbies[payload.roomId].players.includes(socket.id)) {
      socket.to(payload.roomId).emit('game_action', payload);
      // console.log(`Action forwarded in ${payload.roomId}:`, payload.action);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    Object.entries(lobbies).forEach(([roomId, lobby]) => {
      if (!lobby.players.includes(socket.id)) return;

      lobby.players = lobby.players.filter((id) => id !== socket.id);
      if (lobby.players.length === 0) {
        delete lobbies[roomId];
      } else {
        lobby.started = false;
        io.to(roomId).emit('error_message', 'Opponent disconnected');
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
