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

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send initial state
  socket.emit('init', gameState);

  socket.on('move', (payload) => {
    // 1. Validate move
    // 2. Update server state
    // 3. Broadcast to all clients
    console.log(`Player ${socket.id} moved`, payload);

    // Broadcast back for now
    io.emit('state_update', payload);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});