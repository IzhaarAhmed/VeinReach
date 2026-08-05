import { ApiError } from '../utils/ApiError.js';

/**
 * Validate a request part against a Zod schema, replacing it with the parsed
 * (coerced) value. Usage: router.post('/', validate(schema), handler)
 * or validate(schema, 'query') for query params.
 */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req[source] = result.data;
    next();
  };
