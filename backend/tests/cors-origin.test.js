import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, isAllowedOrigin } from '../src/config/env.js';

/**
 * The dev loopback allowance is a deliberate relaxation. These assertions pin
 * down that it stays confined to development and to loopback hosts — a regression
 * here would turn the API into an open CORS target in production.
 */

const withEnv = (patch, fn) => {
  const saved = { isProd: env.isProd, clientUrls: env.clientUrls };
  Object.assign(env, patch);
  try {
    fn();
  } finally {
    Object.assign(env, saved);
  }
};

test('configured client URLs are always allowed', () => {
  withEnv({ isProd: true, clientUrls: ['https://veinreach.app'] }, () => {
    assert.equal(isAllowedOrigin('https://veinreach.app'), true);
  });
});

test('development accepts any loopback origin regardless of port', () => {
  withEnv({ isProd: false, clientUrls: ['http://localhost:3000'] }, () => {
    for (const origin of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://[::1]:4321',
      'https://127.0.0.1:8443',
      'http://localhost',
    ]) {
      assert.equal(isAllowedOrigin(origin), true, `${origin} should be allowed in dev`);
    }
  });
});

test('development still rejects non-loopback origins', () => {
  withEnv({ isProd: false, clientUrls: ['http://localhost:3000'] }, () => {
    for (const origin of [
      'http://evil.example.com',
      'https://veinreach.app.attacker.test',
      // Must not be fooled by a loopback-looking prefix or suffix.
      'http://localhost.attacker.test',
      'http://127.0.0.1.attacker.test',
      'http://notlocalhost:3000',
    ]) {
      assert.equal(isAllowedOrigin(origin), false, `${origin} must be rejected`);
    }
  });
});

test('production rejects loopback origins that are not configured', () => {
  withEnv({ isProd: true, clientUrls: ['https://veinreach.app'] }, () => {
    assert.equal(isAllowedOrigin('http://localhost:3000'), false);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000'), false);
    assert.equal(isAllowedOrigin('http://evil.example.com'), false);
  });
});

test('a missing Origin header is allowed (curl, server-to-server)', () => {
  withEnv({ isProd: true, clientUrls: ['https://veinreach.app'] }, () => {
    assert.equal(isAllowedOrigin(undefined), true);
    assert.equal(isAllowedOrigin(''), true);
  });
});
