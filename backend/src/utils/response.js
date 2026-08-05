/**
 * Standard response envelope per the API design rules:
 *   { success, data, message }
 */
export const ok = (res, data = {}, message = '', status = 200) =>
  res.status(status).json({ success: true, data, message });

export const created = (res, data = {}, message = 'Created') =>
  ok(res, data, message, 201);

/** Wrap async route handlers so thrown/rejected errors reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
