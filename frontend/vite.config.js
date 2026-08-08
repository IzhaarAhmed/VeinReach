import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Any loopback host — localhost, 127.0.0.1, or IPv6 [::1]. */
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/;

/**
 * Fail the production build when the API endpoints are missing or point at a
 * developer's machine.
 *
 * Vite inlines `VITE_*` at build time, and both `lib/api.js` and `lib/socket.js`
 * fall back to `http://localhost:5000` when unset. Without this guard a deploy
 * that forgot the variables builds and loads perfectly, then every request fails
 * — and on an HTTPS page the browser blocks them as mixed content before they
 * are even sent, so the network tab shows no useful error. Failing the build is
 * far cheaper to diagnose than the working-looking site that talks to nothing.
 *
 * Escape hatch for CI and local production smoke builds, which have no real API
 * to point at and only care that the bundle compiles:
 *
 *   VEINREACH_ALLOW_LOCAL_BUILD=1 npm run build
 */
function requireDeployEnv() {
  return {
    name: 'veinreach:require-deploy-env',
    apply: 'build',
    config(_config, { mode }) {
      if (mode !== 'production') return;
      if (process.env.VEINREACH_ALLOW_LOCAL_BUILD === '1') return;

      // Read through loadEnv, not process.env: Vite resolves .env files itself,
      // so a local `frontend/.env` would otherwise look empty and fail here.
      const env = loadEnv(mode, process.cwd(), 'VITE_');
      const problems = [];

      for (const key of ['VITE_API_URL', 'VITE_SOCKET_URL']) {
        const value = env[key];

        if (!value) {
          problems.push(`${key} is not set.`);
          continue;
        }
        if (LOOPBACK.test(value)) {
          problems.push(`${key} points at localhost ("${value}") — unreachable from a browser.`);
          continue;
        }
        try {
          const { protocol } = new URL(value);
          if (protocol !== 'http:' && protocol !== 'https:') {
            problems.push(`${key} must be an http(s) URL, got "${value}".`);
          }
        } catch {
          problems.push(`${key} is not a valid absolute URL: "${value}".`);
        }
      }

      if (problems.length > 0) {
        throw new Error(
          `\n[build] Refusing to build the production bundle:\n` +
            problems.map((p) => `  • ${p}`).join('\n') +
            `\n\nSet both on your host (Cloudflare Pages → Settings → Environment variables):\n` +
            `  VITE_API_URL=https://veinreach-api.onrender.com/api/v1   (includes /api/v1)\n` +
            `  VITE_SOCKET_URL=https://veinreach-api.onrender.com       (origin only)\n\n` +
            `For a build with no real API behind it, set VEINREACH_ALLOW_LOCAL_BUILD=1.\n`
        );
      }

      // Shape mistakes, not fatal — the API base and the socket origin differ by
      // exactly the path suffix, which makes them easy to swap.
      if (!/\/api\/v1\/?$/.test(env.VITE_API_URL))
        console.warn(`[build] warning: VITE_API_URL does not end in /api/v1 — "${env.VITE_API_URL}"`);
      if (/\/api\/v1\/?$/.test(env.VITE_SOCKET_URL))
        console.warn(`[build] warning: VITE_SOCKET_URL should be the bare origin, without /api/v1`);
    },
  };
}

export default defineConfig({
  plugins: [react(), requireDeployEnv()],
  server: {
    port: 3000,
  },
});
