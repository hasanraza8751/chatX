// Wraps async controllers so `throw` / rejected promises reach errorHandler.
// Why: avoids try/catch in every controller (beginner-friendly).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
