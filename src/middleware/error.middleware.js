// last middleware in the chain, catches everything thrown/passed via next(err)
// keeps error responses consistent instead of leaking stack traces to the client

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'internal server error';

  if (!err.isOperational) {
    // only log the full thing for actual bugs, not expected errors like
    // "insufficient balance" etc
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = errorMiddleware;
