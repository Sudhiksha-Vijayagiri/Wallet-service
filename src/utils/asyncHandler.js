// wraps async route handlers so we don't have to write try/catch
// in every single controller function
// if the promise rejects, it just gets passed to next() -> error middleware

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
