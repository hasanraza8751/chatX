const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
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
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'chatx-server',
    env: env.NODE_ENV,
    time: new Date().toISOString(),
  });
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
