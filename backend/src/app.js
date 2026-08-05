import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import { env, isAllowedOrigin } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';
import { issueCsrfToken, verifyCsrf, CSRF_HEADER } from './middleware/csrf.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // correct client IP behind Render/Railway proxies

  app.use(helmet());
  app.use(
    cors({
      // Callback form so development can accept any loopback origin. Rejection
      // is `cb(null, false)` — that just omits the CORS headers, rather than
      // throwing a 500 the way `cb(new Error())` would.
      origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
      credentials: true,
      // Let the SPA read the rotating CSRF token from responses (double-submit).
      exposedHeaders: [CSRF_HEADER],
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  /**
   * Strip Mongo operators ($gt, $ne, …) and dotted paths out of user input.
   *
   * This package was already a dependency but had never been mounted. Most
   * routes validate with Zod, which blocks the whole class — but the ones that
   * pass `req.query` straight into a filter (the admin directory, report and
   * audit listings) did not, so `?verification[$ne]=x` reached the query as a
   * live operator. Must run after the body parsers, since it rewrites req.body.
   */
  app.use(mongoSanitize());

  if (!env.isProd) app.use(morgan('dev'));

  // Global baseline rate limit (auth routes add a stricter one).
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // CSRF: hand every client a token, then require it on mutating requests.
  app.use(issueCsrfToken);
  app.use(verifyCsrf);

  app.use('/api/v1', routes);

  // Everything lives under /api/v1, so the bare root would otherwise 404 with a
  // stack trace. Visiting it is the natural way to check the server is up, so
  // point it at the real entrypoints instead.
  app.get('/', (_req, res) =>
    res.json({
      success: true,
      data: { name: 'VeinReach API', version: 'v1', base: '/api/v1', health: '/api/v1/health' },
      message: 'VeinReach API is running',
    })
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
