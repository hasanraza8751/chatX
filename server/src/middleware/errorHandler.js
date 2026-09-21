// Final error middleware: always returns { message }. Logs details server-side only.
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    console.error('[error]', err);
  }
  const message =
    err.isOperational || status < 500
      ? err.message
      : 'Something went wrong. Please try again.';
  res.status(status).json({ message });
}

module.exports = errorHandler;
