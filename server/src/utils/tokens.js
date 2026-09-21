const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { COOKIE_NAME, getCookieOptions, getClearCookieOptions } = require('../config/cookies');

// Why: single place that signs JWT + sets/clears the httpOnly cookie.
// JWT is NEVER returned in JSON, NEVER stored in localStorage, NEVER in React state.
function signToken(userId) {
  return jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function setAuthCookie(res, userId) {
  const token = signToken(userId);
  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, getClearCookieOptions());
}

module.exports = { signToken, setAuthCookie, clearAuthCookie };
