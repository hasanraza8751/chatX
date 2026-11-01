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
  // Translation (optional — feature degrades gracefully without them).
  // TRANSLATION_PROVIDER: auto|google|mymemory|phrasebook (default auto).
  // GOOGLE_TRANSLATE_API_KEY: server-only secret, enables the Google provider.
  // Without a key the chain falls back to MyMemory free tier, then the
  // offline conversational phrasebook. Deliberately NOT prod-required so
  // existing deployments keep booting.
  TRANSLATION_PROVIDER: process.env.TRANSLATION_PROVIDER || 'auto',
  GOOGLE_TRANSLATE_API_KEY: process.env.GOOGLE_TRANSLATE_API_KEY || '',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
};

// Production fail-fast: never silently fall back to localhost MongoDB,
// localhost CLIENT_URL, or missing secrets/credentials. Names only in the
// error — never values.
if (env.isProd) {
  const REQUIRED_IN_PROD = [
    'PORT',
    'NODE_ENV',
    'MONGODB_URI',
    'JWT_SECRET',
    'CLIENT_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  const missing = REQUIRED_IN_PROD.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars in production: ${missing.join(', ')} (see server/.env.example)`
    );
  }
}

if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
  console.warn('[env] WARNING: JWT_SECRET should be at least 32 characters long.');
}

module.exports = env;
