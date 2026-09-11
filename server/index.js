import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';

import { pool } from './db.js';
import { runMigrations } from './migrate.js';
import {
  baseUrl, loadSession, requireUser, startGoogleAuth, handleGoogleCallback, logout, devLogin,
} from './auth.js';
import { eventsHandler } from './events.js';
import { toHttpError } from './errors.js';
import dataRouter from './routes/data.js';
import adminRouter from './routes/admin.js';
import filesRouter from './routes/files.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(loadSession);

// Defence in depth on top of SameSite=Lax cookies: state-changing requests
// must come from our own origin.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin || origin === new URL(baseUrl()).origin) return next();
  try {
    if (new URL(origin).host === req.headers.host) return next();
  } catch {
    // malformed Origin header
  }
  res.status(403).json({ error: 'בקשה ממקור לא מורשה' });
});

// ----- Auth -----
app.get('/auth/google/start', startGoogleAuth);
app.get('/auth/google/callback', (req, res, next) => handleGoogleCallback(req, res).catch(next));
app.post('/auth/logout', (req, res, next) => logout(req, res).catch(next));
app.get('/auth/dev-login', (req, res, next) => devLogin(req, res).catch(next));

// ----- API -----
app.get('/api/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!req.user) return res.status(401).json({ error: 'נדרשת התחברות' });
  res.json({ user: req.user });
});
app.use('/api', requireUser);
app.get('/api/events', eventsHandler);
app.use('/api/admin', express.json({ limit: '50mb' }), adminRouter);
app.use('/api', express.json({ limit: '10mb' }), dataRouter);
app.use('/api', filesRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// ----- SPA -----
app.use(
  express.static(DIST, {
    index: false,
    setHeaders(res, filePath) {
      const name = path.basename(filePath);
      if (name === 'sw.js' || name === 'registerSW.js' || name.endsWith('.webmanifest') || name.startsWith('workbox-')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);
app.get('*', (req, res) => {
  const index = path.join(DIST, 'index.html');
  if (!fs.existsSync(index)) return res.status(503).send('build missing — run npm run build');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(index);
});

// ----- Errors -----
app.use((err, req, res, _next) => {
  const httpErr = toHttpError(err);
  if (httpErr.status >= 500) console.error('[error]', req.method, req.originalUrl, err);
  if (res.headersSent) return;
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'הבקשה גדולה מדי' });
  res.status(httpErr.status).json({ error: httpErr.message });
});

async function main() {
  await runMigrations();
  const port = Number(process.env.XHOST_HTTP_PORT || process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[server] listening on 0.0.0.0:${port}`);
  });
  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
