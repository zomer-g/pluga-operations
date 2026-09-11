import crypto from 'node:crypto';
import { pool, withTransaction } from './db.js';
import { groupsForNewUser } from './permissions.js';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';

const SESSION_COOKIE = 'pluga_sid';
const STATE_COOKIE = 'pluga_oauth_state';

// Rolling 30-day sessions: people open the PWA on their phone every few days
// and should not be asked to sign in again each time.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EXTEND_AFTER_MS = 24 * 60 * 60 * 1000;

const isProd = () => process.env.NODE_ENV === 'production';

export function baseUrl() {
  return (process.env.BASE_URL || `http://localhost:${process.env.XHOST_HTTP_PORT || process.env.PORT || 3000}`).replace(/\/$/, '');
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret && isProd()) throw new Error('SESSION_SECRET is not set');
  return secret || 'dev-only-secret';
}

function sign(value) {
  const sig = crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
  return `${value}.${sig}`;
}

function unsign(signed) {
  if (typeof signed !== 'string') return null;
  const dot = signed.lastIndexOf('.');
  if (dot <= 0) return null;
  const value = signed.slice(0, dot);
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signed);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return value;
}

const cookieOpts = (maxAge) => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: 'lax',
  path: '/',
  maxAge,
});

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || null;
}

async function createSession(res, req, userId) {
  const sid = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [sid, userId, new Date(Date.now() + SESSION_TTL_MS), clientIp(req), req.headers['user-agent'] ?? null],
  );
  res.cookie(SESSION_COOKIE, sign(sid), cookieOpts(SESSION_TTL_MS));
}

/** Express middleware: attaches req.user ({id, email, name, picture}) when the session is valid. */
export async function loadSession(req, res, next) {
  try {
    const sid = unsign(req.cookies?.[SESSION_COOKIE]);
    if (!sid) return next();
    const { rows } = await pool.query(
      `SELECT s.id AS sid, s.expires_at, u.id, u.email, u.display_name, u.picture
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [sid],
    );
    const row = rows[0];
    if (!row) return next();
    req.user = { id: row.id, email: row.email, name: row.display_name, picture: row.picture ?? '' };
    req.sessionId = row.sid;

    const remaining = new Date(row.expires_at).getTime() - Date.now();
    if (SESSION_TTL_MS - remaining > EXTEND_AFTER_MS) {
      await pool.query('UPDATE sessions SET expires_at = $2 WHERE id = $1', [sid, new Date(Date.now() + SESSION_TTL_MS)]);
      res.cookie(SESSION_COOKIE, sign(sid), cookieOpts(SESSION_TTL_MS));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'נדרשת התחברות' });
  next();
}

function htmlError(res, status, message) {
  res.status(status).type('html').send(
    `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>ניהול פלוגה</title><body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
     <div style="text-align:center;padding:24px"><h2>${message}</h2><a style="color:#93c5fd" href="/">חזרה</a></div></body></html>`,
  );
}

export function startGoogleAuth(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return htmlError(res, 500, 'התחברות Google לא הוגדרה בשרת');
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, sign(state), cookieOpts(10 * 60 * 1000));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${baseUrl()}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  res.redirect(`${GOOGLE_AUTH}?${params}`);
}

export async function handleGoogleCallback(req, res) {
  const { code, state, error } = req.query;
  const expectedState = unsign(req.cookies?.[STATE_COOKIE]);
  res.clearCookie(STATE_COOKIE, { path: '/' });
  if (error) return htmlError(res, 400, 'ההתחברות בוטלה');
  if (!code || !state || state !== expectedState) return htmlError(res, 400, 'בקשת התחברות לא תקינה — נסה שוב');

  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: String(code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${baseUrl()}/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    console.error('[auth] token exchange failed', tokenRes.status, await tokenRes.text());
    return htmlError(res, 400, 'ההתחברות נכשלה — נסה שוב');
  }
  const tokens = await tokenRes.json();
  const profileRes = await fetch(GOOGLE_USERINFO, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  if (!profileRes.ok) return htmlError(res, 400, 'ההתחברות נכשלה — נסה שוב');
  const profile = await profileRes.json();

  const email = String(profile.email || '').toLowerCase();
  const sub = String(profile.sub || '');
  if (!email || !sub || profile.email_verified === false) {
    return htmlError(res, 403, 'חשבון Google ללא כתובת מייל מאומתת');
  }

  const result = await withTransaction(async (db) => {
    await db.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');

    // 1) Known Google identity. 2) Same email — e.g. a user migrated from
    // Firebase whose row still has the old Firebase uid as id.
    let { rows } = await db.query('SELECT id, google_sub FROM users WHERE google_sub = $1', [sub]);
    if (!rows[0]) {
      ({ rows } = await db.query('SELECT id, google_sub FROM users WHERE lower(email) = $1', [email]));
      if (rows[0]?.google_sub && rows[0].google_sub !== sub) {
        return { denied: 'המייל משויך לחשבון Google אחר' };
      }
    }

    if (rows[0]) {
      await db.query(
        'UPDATE users SET google_sub = $2, email = $3, picture = $4, last_login_at = now() WHERE id = $1',
        [rows[0].id, sub, email, profile.picture ?? null],
      );
      return { userId: rows[0].id };
    }

    const { rows: countRows } = await db.query('SELECT count(*)::int AS n FROM users');
    const isFirstUser = countRows[0].n === 0;
    const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').toLowerCase();
    if (isFirstUser && bootstrapEmail && email !== bootstrapEmail) {
      return { denied: 'המערכת בהקמה — ההתחברות הראשונה שמורה למנהל המערכת' };
    }
    if (!isFirstUser && process.env.SIGNUP_MODE === 'closed') {
      return { denied: 'המשתמש שלך לא רשום במערכת. פנה למנהל המערכת.' };
    }

    const userId = crypto.randomUUID();
    await db.query(
      `INSERT INTO users (id, email, display_name, google_sub, picture, last_login_at) VALUES ($1, $2, $3, $4, $5, now())`,
      [userId, email, profile.name || email.split('@')[0], sub, profile.picture ?? null],
    );
    const groupIds = await groupsForNewUser(db, isFirstUser);
    for (const [position, groupId] of groupIds.entries()) {
      await db.query('INSERT INTO user_groups (user_id, position, group_id) VALUES ($1, $2, $3)', [userId, position, groupId]);
    }
    return { userId };
  });

  if (result.denied) return htmlError(res, 403, result.denied);
  await createSession(res, req, result.userId);
  res.redirect('/');
}

export async function logout(req, res) {
  const sid = unsign(req.cookies?.[SESSION_COOKIE]);
  if (sid) await pool.query('UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [sid]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
}

/** Local development only: sign in as DEV_LOGIN_EMAIL without Google. */
export async function devLogin(req, res) {
  const email = (process.env.DEV_LOGIN_EMAIL || '').toLowerCase();
  if (isProd() || process.env.ALLOW_DEV_LOGIN !== '1' || !email) return res.status(404).end();
  const userId = await withTransaction(async (db) => {
    const { rows } = await db.query('SELECT id FROM users WHERE lower(email) = $1', [email]);
    if (rows[0]) return rows[0].id;
    const { rows: c } = await db.query('SELECT count(*)::int AS n FROM users');
    const id = crypto.randomUUID();
    await db.query('INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3)', [id, email, email.split('@')[0]]);
    const groupIds = await groupsForNewUser(db, c[0].n === 0);
    for (const [position, groupId] of groupIds.entries()) {
      await db.query('INSERT INTO user_groups (user_id, position, group_id) VALUES ($1, $2, $3)', [id, position, groupId]);
    }
    return id;
  });
  await createSession(res, req, userId);
  res.redirect('/');
}

/** Used after a restore replaces the users table: move live sessions onto the restored rows by email. */
export async function reattachSessions(db, sessionsByEmail) {
  for (const s of sessionsByEmail) {
    const { rows } = await db.query('SELECT id FROM users WHERE lower(email) = $1', [s.email]);
    if (!rows[0]) continue;
    await db.query('UPDATE users SET google_sub = COALESCE(google_sub, $2), picture = COALESCE(picture, $3) WHERE id = $1', [rows[0].id, s.google_sub, s.picture]);
    await db.query(
      `INSERT INTO sessions (id, user_id, created_at, expires_at, revoked_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [s.id, rows[0].id, s.created_at, s.expires_at, s.revoked_at, s.ip, s.user_agent],
    );
  }
}
