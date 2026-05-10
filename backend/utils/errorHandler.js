const logger = require('./logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async route wrapper to catch errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    logger.error(`Route Error: ${err.message}`, { stack: err.stack });
    next(err);
  });
};

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;

  // Log actual error
  if (err.statusCode === 500) {
    logger.error(`[500] ${err.message}`, { stack: err.stack, url: req.url });
  } else {
    logger.warn(`[${err.statusCode}] ${err.message}`);
  }

  // Send safe response to client
  res.status(err.statusCode).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { AppError, asyncHandler, errorHandler };
