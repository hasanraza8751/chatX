// Friendly error class: every thrown AppError becomes { message } for the frontend.
// Why: never leak stack traces or raw DB errors to users (PRD section 30).
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

module.exports = AppError;
