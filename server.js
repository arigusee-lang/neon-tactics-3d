import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFilePath = path.join(__dirname, 'server.log');
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console)
};

function writeLog(level, args) {
  const timestamp = new Date().toISOString();
  const message = util.format(...args);
  const line = `[${timestamp}] [${level}] ${message}\n`;
  logStream.write(line, (err) => {
    if (err) {
      originalConsole.error(`Failed to write server log: ${err.message}`);
    }
  });
}

['log', 'info', 'warn', 'error', 'debug'].forEach((method) => {
  const level = method.toUpperCase();
  const originalMethod = originalConsole[method];
  console[method] = (...args) => {
    originalMethod(...args);
    writeLog(level, args);
  };
});

process.on('uncaughtException', (error) => {
  const details = error?.stack || String(error);
  writeLog('UNCAUGHT_EXCEPTION', [details]);
});

process.on('unhandledRejection', (reason) => {
  const details = reason?.stack || util.format(reason);
  writeLog('UNHANDLED_REJECTION', [details]);
});

process.on('exit', () => {
  logStream.end();
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 60000
});

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

function loadMapPlayerCounts() {
  const counts = {};
  const mapsDir = path.join(__dirname, 'maps');

  if (!fs.existsSync(mapsDir)) {
    return counts;
  }

  fs.readdirSync(mapsDir)
    .filter((fileName) => fileName.endsWith('.json'))
    .forEach((fileName) => {
      try {
        const raw = fs.readFileSync(path.join(mapsDir, fileName), 'utf8');
        const parsed = JSON.parse(raw);
        const mapId = fileName.replace(/\.json$/i, '');
        const players = parsed?.players;
        counts[mapId] = players === 3 || players === 4 ? players : 2;
      } catch (error) {
        const mapId = fileName.replace(/\.json$/i, '');
        counts[mapId] = 2;
      }
    });

  return counts;
}

function getLobbyCapacity(mapId) {
  const count = loadMapPlayerCounts()[mapId];
  return count === 3 || count === 4 ? count : 2;
}

function getLobbyCapacityFromMapPayload(mapId, mapData) {
  const players = mapData?.players;
  if (players === 3 || players === 4) {
    return players;
  }
  return getLobbyCapacity(mapId);
}

// Lobby management
// Keep stable player slots so transient socket disconnects do not destroy the room.
const lobbies = {}; // { roomId: { playerSlots: [...], authorityPlayerId: string, authoritySocketId: string | null, gameState: any, mapId: string, currentTurn: string, turnOrder: string[], maxPlayers: number, started: boolean } }

const PLAYER_ONE = 'P1';
const PLAYER_TWO = 'P2';
const PLAYER_THREE = 'P3';
const PLAYER_FOUR = 'P4';
const PLAYER_IDS = [PLAYER_ONE, PLAYER_TWO, PLAYER_THREE, PLAYER_FOUR];

const AUTHORITATIVE_ACTIONS = new Set([
  'SYNC_STATE',
  'ADMIN_SET_UNIT_STATS',
  'FLUX_TOWER_ATTACK_UPGRADE',
  'MOVE',
  'ATTACK',
  'SKIP_TURN',
  'TELEPORT',
  'PLACE_UNIT',
  'ION_CANNON_STRIKE',
  'FORWARD_BASE_PLACE',
  'MASS_RETREAT_EXECUTE',
  'FREEZE_TARGET',
  'HEAL_TARGET',
  'RESTORE_ENERGY_TARGET',
  'IMMORTALITY_SHIELD_TARGET',
  'DISPEL_TARGET',
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
  'FLUX_TOWER_ATTACK_UPGRADE',
  'MOVE',
  'ATTACK',
  'SKIP_TURN',
  'TELEPORT',
  'PLACE_UNIT',
  'ION_CANNON_STRIKE',
  'FORWARD_BASE_PLACE',
  'MASS_RETREAT_EXECUTE',
  'FREEZE_TARGET',
  'HEAL_TARGET',
  'RESTORE_ENERGY_TARGET',
  'IMMORTALITY_SHIELD_TARGET',
  'DISPEL_TARGET',
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

function getNextTurn(currentTurn, turnOrder = PLAYER_IDS) {
  const currentIndex = turnOrder.indexOf(currentTurn);
  if (currentIndex === -1 || turnOrder.length === 0) {
    return turnOrder[0] || PLAYER_ONE;
  }
  return turnOrder[(currentIndex + 1) % turnOrder.length];
}

function createEmptyCharacterSelections() {
  return {
    [PLAYER_ONE]: null,
    [PLAYER_TWO]: null,
    [PLAYER_THREE]: null,
    [PLAYER_FOUR]: null,
    NEUTRAL: null
  };
}

function createPlayerSlots(turnOrder, initialSocketId) {
  return turnOrder.map((playerId, index) => ({
    playerId,
    socketId: index === 0 ? initialSocketId : null,
    connectionState: index === 0 ? 'connected' : 'open',
    joinedAt: index === 0 ? Date.now() : null,
    disconnectedAt: null,
    lastSeenAt: index === 0 ? Date.now() : null
  }));
}

function getPlayerSlotByPlayerId(lobby, playerId) {
  return lobby.playerSlots.find((slot) => slot.playerId === playerId) || null;
}

function getPlayerSlotBySocketId(lobby, socketId) {
  return lobby.playerSlots.find((slot) => slot.socketId === socketId) || null;
}

function getPlayerIdForSocket(lobby, socketId) {
  return getPlayerSlotBySocketId(lobby, socketId)?.playerId || null;
}

function getConnectedSlots(lobby) {
  return lobby.playerSlots.filter((slot) => slot.connectionState === 'connected' && !!slot.socketId);
}

function getDisconnectedSlots(lobby) {
  return lobby.playerSlots.filter((slot) => slot.connectionState === 'disconnected');
}

function getOpenSlots(lobby) {
  return lobby.playerSlots.filter((slot) => slot.connectionState === 'open');
}

function getJoinedSlots(lobby) {
  return lobby.playerSlots.filter((slot) => slot.connectionState !== 'open');
}

function getConnectedSocketIds(lobby) {
  return getConnectedSlots(lobby)
    .map((slot) => slot.socketId)
    .filter(Boolean);
}

function getLobbyPlayerIds(lobby) {
  return lobby.playerSlots.map((slot) => slot.playerId);
}

function refreshLobbyAuthority(lobby) {
  const authoritySlot = getPlayerSlotByPlayerId(lobby, lobby.authorityPlayerId);
  lobby.authoritySocketId = authoritySlot?.connectionState === 'connected' ? authoritySlot.socketId : null;
}

function isLobbyFull(lobby) {
  return getJoinedSlots(lobby).length === lobby.maxPlayers;
}

function isLobbyPausedForDisconnect(lobby) {
  return !!lobby.started && getDisconnectedSlots(lobby).length > 0;
}

function getLobbyPhase(lobby) {
  if (!lobby.started) return 'LOBBY';
  if (!lobby.gameState) return 'CHARACTER_SELECTION';
  return 'IN_PROGRESS';
}

function emitLobbyState(roomId, lobby) {
  io.to(roomId).emit('lobby_state', {
    roomId,
    mapId: lobby.mapId || 'MAP_1',
    mapData: lobby.mapData || null,
    players: lobby.playerSlots.map((slot) => slot.socketId),
    playerIds: getLobbyPlayerIds(lobby),
    connectedPlayerIds: getConnectedSlots(lobby).map((slot) => slot.playerId),
    disconnectedPlayerIds: getDisconnectedSlots(lobby).map((slot) => slot.playerId),
    maxPlayers: lobby.maxPlayers || 2,
    started: !!lobby.started,
    authoritySocketId: lobby.authoritySocketId || null,
    hostAdminEnabled: !!lobby.hostAdminEnabled,
    fogOfWarDisabled: !!lobby.fogOfWarDisabled,
    phase: getLobbyPhase(lobby),
    pausedForDisconnect: isLobbyPausedForDisconnect(lobby)
  });
}

function assignSocketToSlot(socket, roomId, lobby, slot) {
  socket.join(roomId);
  socket.data.roomId = roomId;
  socket.data.playerId = slot.playerId;
  slot.socketId = socket.id;
  slot.connectionState = 'connected';
  slot.joinedAt = slot.joinedAt || Date.now();
  slot.disconnectedAt = null;
  slot.lastSeenAt = Date.now();
  refreshLobbyAuthority(lobby);
}

function releaseSocketFromLobby(socket, roomId) {
  socket.leave(roomId);
  socket.data.roomId = null;
  socket.data.playerId = null;
}

function removePlayerFromLobby(socket, roomId, lobby, departureMessage = 'Opponent left the lobby') {
  const departingSlot = getPlayerSlotBySocketId(lobby, socket.id);
  if (!departingSlot) return;

  releaseSocketFromLobby(socket, roomId);

  departingSlot.socketId = null;
  departingSlot.connectionState = 'open';
  departingSlot.joinedAt = null;
  departingSlot.disconnectedAt = null;
  departingSlot.lastSeenAt = Date.now();

  lobby.selectedCharacters = {
    ...createEmptyCharacterSelections(),
    ...(lobby.selectedCharacters || {}),
    [departingSlot.playerId]: null
  };

  if (getConnectedSlots(lobby).length === 0) {
    console.log(`[ROOM][CLEANUP] room=${roomId} reason=all_players_left`);
    delete lobbies[roomId];
    return;
  }

  lobby.started = false;
  lobby.currentTurn = lobby.turnOrder?.[0] || PLAYER_ONE;
  lobby.gameState = null;
  lobby.selectedCharacters = createEmptyCharacterSelections();
  refreshLobbyAuthority(lobby);

  emitLobbyState(roomId, lobby);
  io.to(roomId).emit('error_message', departureMessage);
}

function markPlayerDisconnected(socket, roomId, lobby, reason = 'transport disconnect') {
  const departingSlot = getPlayerSlotBySocketId(lobby, socket.id);
  if (!departingSlot) return;

  departingSlot.socketId = null;
  departingSlot.connectionState = 'disconnected';
  departingSlot.disconnectedAt = Date.now();
  departingSlot.lastSeenAt = Date.now();
  socket.data.roomId = null;
  socket.data.playerId = null;
  refreshLobbyAuthority(lobby);

  const connectedCount = getConnectedSlots(lobby).length;
  const joinedCount = getJoinedSlots(lobby).length;
  console.warn(`[ROOM][DISCONNECT] room=${roomId} player=${departingSlot.playerId} socket=${socket.id} reason=${reason} connected=${connectedCount}/${joinedCount} phase=${getLobbyPhase(lobby)}`);

  if (connectedCount === 0) {
    console.log(`[ROOM][CLEANUP] room=${roomId} reason=all_players_disconnected`);
    delete lobbies[roomId];
    return;
  }

  emitLobbyState(roomId, lobby);
  io.to(roomId).emit('player_connection_state', {
    roomId,
    playerId: departingSlot.playerId,
    connected: false,
    reason,
    disconnectedPlayerIds: getDisconnectedSlots(lobby).map((slot) => slot.playerId),
    connectedPlayerIds: getConnectedSlots(lobby).map((slot) => slot.playerId),
    phase: getLobbyPhase(lobby)
  });
}

function emitGameStart(roomId, lobby) {
  io.to(roomId).emit('game_start', {
    roomId,
    players: lobby.playerSlots.map((slot) => slot.socketId),
    playerIds: getLobbyPlayerIds(lobby),
    mapId: lobby.mapId || 'MAP_1',
    mapData: lobby.mapData || null,
    authoritySocketId: lobby.authoritySocketId,
    hostAdminEnabled: !!lobby.hostAdminEnabled,
    fogOfWarDisabled: !!lobby.fogOfWarDisabled,
    turnOrder: lobby.turnOrder
  });
}

function emitGameResume(socket, roomId, lobby, playerId) {
  socket.emit('game_resume', {
    roomId,
    playerId,
    players: lobby.playerSlots.map((slot) => slot.socketId),
    playerIds: getLobbyPlayerIds(lobby),
    connectedPlayerIds: getConnectedSlots(lobby).map((slot) => slot.playerId),
    disconnectedPlayerIds: getDisconnectedSlots(lobby).map((slot) => slot.playerId),
    maxPlayers: lobby.maxPlayers,
    mapId: lobby.mapId || 'MAP_1',
    mapData: lobby.mapData || null,
    authoritySocketId: lobby.authoritySocketId,
    hostAdminEnabled: !!lobby.hostAdminEnabled,
    fogOfWarDisabled: !!lobby.fogOfWarDisabled,
    turnOrder: lobby.turnOrder,
    phase: getLobbyPhase(lobby),
    selectedCharacters: lobby.selectedCharacters || createEmptyCharacterSelections(),
    gameState: lobby.gameState || null
  });
}

function normalizeJoinLobbyPayload(payload) {
  if (typeof payload === 'string') {
    return {
      roomId: payload,
      preferredPlayerId: null,
      restoreSession: false
    };
  }

  return {
    roomId: typeof payload?.roomId === 'string' ? payload.roomId : '',
    preferredPlayerId: typeof payload?.preferredPlayerId === 'string' ? payload.preferredPlayerId : null,
    restoreSession: !!payload?.restoreSession
  };
}

function resolveJoinSlot(lobby, preferredPlayerId) {
  if (preferredPlayerId) {
    const preferredSlot = getPlayerSlotByPlayerId(lobby, preferredPlayerId);
    if (preferredSlot && preferredSlot.connectionState !== 'connected') {
      return preferredSlot;
    }
  }

  if (!lobby.started) {
    return getOpenSlots(lobby)[0] || (getDisconnectedSlots(lobby).length === 1 ? getDisconnectedSlots(lobby)[0] : null);
  }

  return getDisconnectedSlots(lobby).length === 1 ? getDisconnectedSlots(lobby)[0] : null;
}

function emitJoinFailure(socket, restoreSession, roomId, reason, message) {
  if (restoreSession) {
    socket.emit('session_restore_failed', { roomId, reason });
    return;
  }

  socket.emit('error_message', message);
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.data.roomId = null;
  socket.data.playerId = null;

  // 1. Create Lobby
  socket.on('create_lobby', (payload = {}) => {
    const mapId = typeof payload?.mapId === 'string' ? payload.mapId : 'MAP_1';
    const mapData = payload?.mapData && typeof payload.mapData === 'object' ? payload.mapData : null;
    const hostAdminEnabled = !!payload?.hostAdminEnabled;
    const fogOfWarDisabled = !!payload?.fogOfWarDisabled;
    const maxPlayers = getLobbyCapacityFromMapPayload(mapId, mapData);
    const turnOrder = PLAYER_IDS.slice(0, maxPlayers);
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const playerSlots = createPlayerSlots(turnOrder, socket.id);
    lobbies[roomId] = {
      playerSlots,
      authorityPlayerId: turnOrder[0] || PLAYER_ONE,
      authoritySocketId: socket.id,
      hostAdminEnabled,
      fogOfWarDisabled,
      gameState: null,
      selectedCharacters: createEmptyCharacterSelections(),
      mapId,
      mapData,
      currentTurn: turnOrder[0] || PLAYER_ONE,
      turnOrder,
      maxPlayers,
      started: false
    };
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.playerId = turnOrder[0] || PLAYER_ONE;
    emitLobbyState(roomId, lobbies[roomId]);
    socket.emit('lobby_created', {
      roomId,
      playerId: turnOrder[0] || PLAYER_ONE,
      mapId,
      mapData,
      authoritySocketId: socket.id,
      hostAdminEnabled,
      fogOfWarDisabled
    });
    console.log(`[ROOM][CREATE] room=${roomId} hostSocket=${socket.id} player=${turnOrder[0] || PLAYER_ONE} map=${mapId} maxPlayers=${maxPlayers} hostAdmin=${hostAdminEnabled} fogOff=${fogOfWarDisabled}`);
  });

  // 2. Join Lobby
  socket.on('join_lobby', (payload) => {
    const { roomId, preferredPlayerId, restoreSession } = normalizeJoinLobbyPayload(payload);
    const lobby = lobbies[roomId];

    if (!lobby) {
      emitJoinFailure(socket, restoreSession, roomId, 'ROOM_NOT_FOUND', 'Lobby not found or full');
      return;
    }

    const slot = resolveJoinSlot(lobby, preferredPlayerId);
    if (!slot) {
      const reason = lobby.started ? 'REJOIN_SLOT_UNAVAILABLE' : 'LOBBY_FULL';
      const message = lobby.started
        ? 'Game is waiting for a disconnected player to reconnect'
        : 'Lobby not found or full';
      emitJoinFailure(socket, restoreSession, roomId, reason, message);
      return;
    }

    if (slot.connectionState === 'open') {
      lobby.selectedCharacters = createEmptyCharacterSelections();
      lobby.gameState = null;
      lobby.currentTurn = lobby.turnOrder?.[0] || PLAYER_ONE;
    }

    assignSocketToSlot(socket, roomId, lobby, slot);
    emitLobbyState(roomId, lobby);

    const connectedCount = getConnectedSlots(lobby).length;
    console.log(`[ROOM][JOIN] room=${roomId} socket=${socket.id} player=${slot.playerId} restore=${restoreSession} connected=${connectedCount}/${lobby.maxPlayers} phase=${getLobbyPhase(lobby)}`);

    if (!lobby.started && isLobbyFull(lobby)) {
      lobby.started = true;
      emitLobbyState(roomId, lobby);
      emitGameStart(roomId, lobby);
      console.log(`[ROOM][START] room=${roomId} players=${getLobbyPlayerIds(lobby).join(',')} map=${lobby.mapId || 'MAP_1'}`);
      return;
    }

    if (lobby.started) {
      io.to(roomId).emit('player_connection_state', {
        roomId,
        playerId: slot.playerId,
        connected: true,
        reason: restoreSession ? 'session_restore' : 'join_lobby',
        disconnectedPlayerIds: getDisconnectedSlots(lobby).map((entry) => entry.playerId),
        connectedPlayerIds: getConnectedSlots(lobby).map((entry) => entry.playerId),
        phase: getLobbyPhase(lobby)
      });
      emitGameResume(socket, roomId, lobby, slot.playerId);
    }
  });

  socket.on('leave_lobby', (roomId) => {
    const lobby = lobbies[roomId];
    if (!lobby) return;

    removePlayerFromLobby(socket, roomId, lobby, 'Opponent left the lobby');
  });

  socket.on('character_select', (payload = {}) => {
    const { roomId, charId } = payload;
    if (!roomId || typeof charId !== 'string') {
      socket.emit('error_message', 'Invalid character selection');
      return;
    }

    const lobby = lobbies[roomId];
    if (!lobby || !getPlayerSlotBySocketId(lobby, socket.id)) {
      socket.emit('error_message', 'Lobby not found');
      return;
    }

    const playerId = getPlayerIdForSocket(lobby, socket.id);
    if (!playerId) {
      socket.emit('error_message', 'Player role unresolved');
      return;
    }

    if (!PLAYER_IDS.includes(playerId)) {
      socket.emit('error_message', 'Unsupported player slot');
      return;
    }

    lobby.selectedCharacters = {
      ...createEmptyCharacterSelections(),
      ...(lobby.selectedCharacters || {}),
      [playerId]: charId
    };

    io.to(roomId).emit('character_selection_update', {
      playerCharacters: lobby.selectedCharacters
    });

    const requiredPlayerIds = getJoinedSlots(lobby).map((slot) => slot.playerId);
    const allSelected = requiredPlayerIds.length > 0
      && requiredPlayerIds.every((id) => lobby.selectedCharacters?.[id]);

    if (allSelected) {
      io.to(roomId).emit('character_selection_complete', {
        playerCharacters: lobby.selectedCharacters
      });
    }
  });

  // 3. Authoritative Command Channel (initial vertical slice)
  socket.on('authoritative_command_request', (payload = {}) => {
    const { roomId, action } = payload;
    let data = payload.data;
    const reject = (reason) => {
      console.warn(`[AUTH][REJECT] room=${roomId || 'n/a'} socket=${socket.id} action=${action || 'UNKNOWN'} reason=${reason}`);
      socket.emit('command_rejected', { action: action || 'UNKNOWN', reason });
    };

    if (action !== 'SYNC_STATE') {
      console.log(`[AUTH][IN] room=${roomId || 'n/a'} socket=${socket.id} action=${action || 'UNKNOWN'}`);
    }

    if (!roomId || typeof action !== 'string') {
      reject('INVALID_PAYLOAD');
      return;
    }

    if (!AUTHORITATIVE_ACTIONS.has(action)) {
      reject('UNSUPPORTED_ACTION');
      return;
    }

    const lobby = lobbies[roomId];
    if (!lobby) {
      reject('ROOM_NOT_FOUND');
      return;
    }

    if (!getPlayerSlotBySocketId(lobby, socket.id)) {
      reject('NOT_IN_ROOM');
      return;
    }

    if (!lobby.started) {
      reject('GAME_NOT_STARTED');
      return;
    }

    if (action !== 'SYNC_STATE' && isLobbyPausedForDisconnect(lobby)) {
      reject('GAME_PAUSED_PLAYER_DISCONNECTED');
      return;
    }

    if (action === 'SYNC_STATE') {
      if (socket.id !== lobby.authoritySocketId) {
        reject('NOT_STATE_AUTHORITY');
        return;
      }

      if (!data || typeof data !== 'object') {
        reject('INVALID_STATE_PAYLOAD');
        return;
      }

      const turnBefore = lobby.currentTurn;
      if (typeof data.currentTurn === 'string' && data.currentTurn.length > 0) {
        lobby.currentTurn = data.currentTurn;
      }
      lobby.gameState = data;

      io.to(roomId).emit('authoritative_command', {
        action,
        data,
        meta: {
          actorPlayerId: getPlayerIdForSocket(lobby, socket.id),
          turnBefore,
          turnAfter: lobby.currentTurn,
          timestamp: Date.now()
        }
      });
      return;
    }

    const actorPlayerId = getPlayerIdForSocket(lobby, socket.id);
    if (!actorPlayerId) {
      reject('PLAYER_ID_UNRESOLVED');
      return;
    }

    if (action === 'ADMIN_SET_UNIT_STATS') {
      if (!lobby.hostAdminEnabled || socket.id !== lobby.authoritySocketId) {
        reject('ADMIN_ONLY');
        return;
      }
    }

    if (TURN_GATED_ACTIONS.has(action) && actorPlayerId !== lobby.currentTurn) {
      reject('NOT_YOUR_TURN');
      return;
    }

    if (ACTIONS_WITH_EXPLICIT_PLAYER.has(action)) {
      const payloadPlayer = data?.playerId;
      if (payloadPlayer && payloadPlayer !== actorPlayerId) {
        reject('PLAYER_MISMATCH');
        return;
      }
      data = { ...(data || {}), playerId: actorPlayerId };
    }

    const turnBefore = lobby.currentTurn;
    if (action === 'SKIP_TURN') {
      lobby.currentTurn = getNextTurn(lobby.currentTurn, lobby.turnOrder);
    }

    if (action === 'MOVE') {
      const pathLen = Array.isArray(data?.path) ? data.path.length : 0;
      const target = pathLen > 0 ? data.path[pathLen - 1] : null;
      console.log(`[AUTH][MOVE] room=${roomId} actor=${actorPlayerId} turn=${lobby.currentTurn} pathLen=${pathLen} target=${target ? `${target.x},${target.z}` : 'n/a'}`);
    }

    io.to(lobby.authoritySocketId).emit('authoritative_command', {
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
    const lobby = payload.roomId ? lobbies[payload.roomId] : null;
    if (payload.roomId && lobby && getPlayerSlotBySocketId(lobby, socket.id) && !isLobbyPausedForDisconnect(lobby)) {
      socket.to(payload.roomId).emit('game_action', payload);
      // console.log(`Action forwarded in ${payload.roomId}:`, payload.action);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id} | reason=${reason}`);
    const roomId = socket.data?.roomId;
    if (!roomId) return;
    const lobby = lobbies[roomId];
    if (!lobby) return;
    markPlayerDisconnected(socket, roomId, lobby, reason);
  });
});

io.engine.on('connection_error', (err) => {
  console.warn(`[SOCKET][ENGINE_ERROR] code=${err.code} message=${err.message} context=${JSON.stringify(err.context || {})}`);
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
