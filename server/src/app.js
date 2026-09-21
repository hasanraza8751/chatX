const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Why each middleware:
// - helmet: secure HTTP headers.
// - cors { origin, credentials:true }: allow frontend origin AND cookies.
//   Must match Socket.IO cors + frontend withCredentials (approved correction).
// - morgan: dev request logs.
// - cookieParser: populates req.cookies (where auth reads JWT).
// - express.json: parse JSON bodies (limit prevents huge payloads).
app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);
app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

// Health check: used by Phase 1 test + frontend "backend status" indicator.
// Liveness only: answers whether the process is up. Use /api/ready for
// deployment gates that must also verify MongoDB connectivity.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'chatx-server',
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

// Readiness probe for production: 200 only when MongoDB is reachable.
// Never exposes URIs, credentials, or stack traces.
app.get('/api/ready', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, message: 'Database not connected.' });
    }
    await mongoose.connection.db.admin().ping();
    return res.json({ ok: true, service: 'chatx-server', time: new Date().toISOString() });
  } catch (err) {
    return res.status(503).json({ ok: false, message: 'Database not ready.' });
  }
});

// Placeholder routers land here in Phase 2+ (auth/users/conversations/messages).
// Keeping app.js thin: routes -> controllers -> services -> models.
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/conversations', require('./routes/conversation.routes'));
app.use('/api/messages', require('./routes/message.routes'));

// 404 for unknown /api routes (friendly, no stack).
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.use(errorHandler);

module.exports = app;
