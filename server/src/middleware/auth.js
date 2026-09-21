const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { COOKIE_NAME } = require('../config/cookies');

// REST auth: reads JWT from httpOnly cookie (never from localStorage / Authorization header).
// Used by GET /api/auth/me and all private routes in later phases.
function auth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ message: 'Not authorized. Please log in.' });
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.userId = decoded.id;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
}

module.exports = auth;
