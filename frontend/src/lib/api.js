import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL,
  withCredentials: true, // send the httpOnly refresh cookie
  // Without this axios waits forever, so a stalled backend surfaces as the
  // misleading "can't reach the server" message instead of the timeout copy
  // friendlyError() already writes. Large uploads go straight to R2 via
  // presigned URLs, not through this instance, so 20s is comfortably generous.
  timeout: 20000,
});

/* In-memory access token. Kept out of localStorage to reduce XSS blast radius;
   the long-lived refresh token lives in an httpOnly cookie. */
let accessToken = null;
export const setAccessToken = (t) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

/* CSRF double-submit token. The server sets an httpOnly cookie AND echoes the
   value in the X-CSRF-Token response header (which we can read cross-origin);
   we keep it in memory and send it back on every mutating request. */
let csrfToken = null;
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);
const captureCsrf = (headers) => {
  const t = headers?.['x-csrf-token'];
  if (t) csrfToken = t;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (csrfToken && MUTATING.has((config.method || 'get').toLowerCase()))
    config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

/* On 401, try a single refresh then replay the original request. */
let refreshing = null;

api.interceptors.response.use(
  (res) => {
    captureCsrf(res.headers);
    return res;
  },
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    // Even on failure the server sends a fresh CSRF token — pick it up.
    captureCsrf(error.response?.headers);

    if (status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          api.post('/auth/refresh').then((r) => {
            setAccessToken(r.data?.data?.accessToken);
            return r;
          });
        await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        setAccessToken(null);
        return Promise.reject(e);
      }
    }

    // A stale/missing CSRF token — retry once now that captureCsrf refreshed it.
    if (
      status === 403 &&
      error.response?.data?.data?.details?.code === 'CSRF_FAILED' &&
      !original._csrfRetry
    ) {
      original._csrfRetry = true;
      return api(original);
    }

    return Promise.reject(error);
  }
);

/** Normalize the backend envelope { success, data, message } and surface messages. */
export const unwrap = (promise) =>
  promise.then((r) => r.data?.data).catch((err) => {
    const msg = err.response?.data?.message || err.message || 'Request failed';
    throw new Error(msg);
  });

/**
 * Turn an axios error into a user-facing message, distinguishing a real API
 * rejection (has a response — e.g. wrong password) from "we never reached the
 * server" (backend down, offline, wrong URL), which otherwise both surface as
 * the same unhelpful fallback.
 */
export const friendlyError = (err, fallback = 'Something went wrong') => {
  // Server answered — trust its message (e.g. "Invalid credentials").
  if (err?.response) return err.response.data?.message || fallback;

  // Request sent but timed out waiting for a reply.
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(err?.message || ''))
    return "The server's taking longer than a slow drip. Give it a moment and try again.";

  // No response at all — the API is unreachable.
  return "We can't reach the VeinReach server — it's not showing a pulse. Make sure the backend is running, then try again.";
};
