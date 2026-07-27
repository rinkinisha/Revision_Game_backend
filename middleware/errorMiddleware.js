/**
 * middleware/errorMiddleware.js
 * Global error handling middleware for Express.
 */

/**
 * notFound – Handles 404 for undefined routes
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route Not Found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * errorHandler – Centralized error response formatter
 */
const errorHandler = (err, req, res, next) => {
  console.error('\n❌ GLOBAL ERROR:', err);
  
  // If status is 200 but error thrown, set to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    // Stack trace only in development mode
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = { notFound, errorHandler };
