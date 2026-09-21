const http = require('http');
const { Server } = require('socket.io');
const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const initSockets = require('./src/sockets');

// Same CORS contract as Express: exact frontend origin + credentials:true.
// If origin or credentials mismatch, browser drops cookies and Socket handshake fails.
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});
// Exposed so REST controllers can emit AFTER MongoDB persistence (delivery layer only).
app.set('io', io);
initSockets(io);

async function start() {
  // trust proxy needed in production (Render/Railway) for Secure cookies.
  if (env.isProd) {
    app.set('trust proxy', 1);
  }

  // Listen FIRST so /api/health works even when MongoDB is down (Phase 1).
  // DB connects in the background; later phases require DB for auth/messaging.
  server.listen(env.PORT, () => {
    console.log(`[server] ChatX running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[server] Allowing frontend origin: ${env.CLIENT_URL}`);
  });

  try {
    await connectDB(env.MONGODB_URI);
    // Presence is tracked in memory: a restart orphans isOnline=true flags,
    // so clear them on boot (best-effort; sockets re-announce on reconnect).
    try {
      const User = require('./src/models/User');
      await User.updateMany({ isOnline: true }, { $set: { isOnline: false } });
    } catch (err) {
      console.warn('[db] presence reset skipped:', err.message);
    }
  } catch (err) {
    console.warn('[db] Could not connect to MongoDB. Server still running for Phase 1.');
    console.warn(`[db] Reason: ${err.message}`);
    console.warn('[db] Start local MongoDB or set MONGODB_URI in server/.env');
  }
}

start();
