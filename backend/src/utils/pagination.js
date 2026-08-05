/**
 * Parse ?page & ?limit query params into { limit, skip, page } with sane
 * bounds. Keeps unbounded queries out of the list endpoints (spec: no
 * silent caps — the caller returns `total` so clients can page).
 */
export function paginate(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

/** Standard paginated envelope payload. */
export function pageMeta({ page, limit, total }) {
  return { page, limit, total, pages: Math.ceil(total / limit) || 1 };
}
