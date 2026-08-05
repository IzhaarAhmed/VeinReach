import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/** 404 fallthrough for unmatched routes. */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Centralized error handler — formats every error into the response envelope. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Mongoose / Mongo specific translations.
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  }

  if (status >= 500) logger.error(err);

  res.status(status).json({
    success: false,
    data: details ? { details } : {},
    message,
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}
