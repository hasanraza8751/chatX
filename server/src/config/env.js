// Central env validation (beginner-friendly: fail fast with a clear message).
// Why: avoids silent misconfig (wrong DB, missing JWT secret, wrong frontend URL).
require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see server/.env.example)`);
  }
  return value;
}

const env = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/chatx'),
  JWT_SECRET: required('JWT_SECRET', null),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: required('CLIENT_URL', 'http://localhost:5173'),
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
  console.warn('[env] WARNING: JWT_SECRET should be at least 32 characters long.');
}

module.exports = env;
