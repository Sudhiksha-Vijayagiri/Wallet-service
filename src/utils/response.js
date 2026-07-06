// keeps every response in the same shape so the frontend (whenever we
// build it) doesn't have to guess the structure each time

function successResponse(res, statusCode = 200, message = 'success', data = null) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

function errorResponse(res, statusCode = 500, message = 'something went wrong') {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = { successResponse, errorResponse };
