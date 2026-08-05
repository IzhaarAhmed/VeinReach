import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueCsrfToken, verifyCsrf, CSRF_COOKIE } from '../src/middleware/csrf.js';

/** Minimal Express-ish req/res mocks. */
function mockReq({ method = 'GET', path = '/api/v1/x', cookies = {}, headers = {} } = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, path, cookies, get: (name) => lower[name.toLowerCase()] };
}
function mockRes() {
  return {
    cookies: {},
    outHeaders: {},
    cookie(name, val) { this.cookies[name] = val; },
    setHeader(name, val) { this.outHeaders[name] = val; },
  };
}
function runNext() {
  let err;
  const next = (e) => { err = e; };
  return { next, error: () => err };
}

test('issueCsrfToken sets a cookie + header for a fresh client', () => {
  const req = mockReq();
  const res = mockRes();
  const { next } = runNext();
  issueCsrfToken(req, res, next);
  assert.ok(res.cookies[CSRF_COOKIE], 'cookie set');
  assert.equal(res.outHeaders['X-CSRF-Token'], res.cookies[CSRF_COOKIE], 'header matches cookie');
});

test('issueCsrfToken reuses an existing cookie', () => {
  const req = mockReq({ cookies: { [CSRF_COOKIE]: 'existing-token' } });
  const res = mockRes();
  issueCsrfToken(req, res, () => {});
  assert.equal(res.cookies[CSRF_COOKIE], undefined, 'does not overwrite');
  assert.equal(res.outHeaders['X-CSRF-Token'], 'existing-token');
});

test('verifyCsrf allows safe methods', () => {
  const { next, error } = runNext();
  verifyCsrf(mockReq({ method: 'GET' }), mockRes(), next);
  assert.equal(error(), undefined);
});

test('verifyCsrf exempts auth bootstrap routes', () => {
  const { next, error } = runNext();
  verifyCsrf(mockReq({ method: 'POST', path: '/api/v1/auth/login' }), mockRes(), next);
  assert.equal(error(), undefined);
});

test('verifyCsrf passes when header matches cookie', () => {
  const { next, error } = runNext();
  const req = mockReq({
    method: 'POST',
    path: '/api/v1/requests',
    cookies: { [CSRF_COOKIE]: 'tok123' },
    headers: { 'X-CSRF-Token': 'tok123' },
  });
  verifyCsrf(req, mockRes(), next);
  assert.equal(error(), undefined);
});

test('verifyCsrf rejects a mismatched or missing token', () => {
  for (const headers of [{ 'X-CSRF-Token': 'wrong' }, {}]) {
    const { next, error } = runNext();
    const req = mockReq({
      method: 'POST',
      path: '/api/v1/requests',
      cookies: { [CSRF_COOKIE]: 'tok123' },
      headers,
    });
    verifyCsrf(req, mockRes(), next);
    assert.ok(error(), 'error raised');
    assert.equal(error().statusCode, 403);
  }
});
