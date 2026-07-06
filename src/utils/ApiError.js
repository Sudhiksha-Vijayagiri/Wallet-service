// custom error class so we can attach a http status code to errors
// and throw them from anywhere (service layer mostly) and let the
// error middleware handle the response formatting

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // means "this is an expected error, not a bug"
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
