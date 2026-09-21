const env = require('./env');

// Single cookie name used by REST + Socket.IO (approved correction).
const COOKIE_NAME = 'chatx_token';

// Why these settings:
// - httpOnly: JS cannot read it (XSS protection).
// - secure + sameSite depend on dev vs prod (see approved architecture).
//   localhost :5173 <-> :5000 are same-site (same host), so Lax works.
//   Vercel <-> Render are cross-site, so None + Secure (HTTPS) is required.
function getCookieOptions() {
  if (env.isProd) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT_EXPIRES_IN default)
    };
  }
  return {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

// clearCookie must use the same path/sameSite/secure, otherwise the browser keeps the cookie.
function getClearCookieOptions() {
  const opts = getCookieOptions();
  delete opts.maxAge;
  return opts;
}

module.exports = { COOKIE_NAME, getCookieOptions, getClearCookieOptions };
