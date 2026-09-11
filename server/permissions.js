import crypto from 'node:crypto';
import { HttpError } from './errors.js';

const LEVELS = { view: 1, edit: 2, admin: 3 };

// Keep in sync with ALL_PAGE_ROUTES in src/lib/constants.ts.
export const ALL_PAGE_ROUTES = [
  '/', '/soldiers', '/equipment', '/shampaf', '/assignments', '/routine',
  '/officer-tasks', '/training', '/donations', '/reports', '/settings', '/permissions',
];

/** Highest permission the user has on `route`: a per-page override wins, else the best group grant. */
export async function getPermissionLevel(db, userId, route) {
  const override = await db.query(
    'SELECT action FROM user_page_overrides WHERE user_id = $1 AND route = $2',
    [userId, route],
  );
  if (override.rows[0]) return override.rows[0].action;

  const { rows } = await db.query(
    `SELECT gpp.action FROM user_groups ug
       JOIN group_page_permissions gpp ON gpp.group_id = ug.group_id
      WHERE ug.user_id = $1 AND gpp.route = $2`,
    [userId, route],
  );
  let best = null;
  for (const r of rows) {
    if (!best || LEVELS[r.action] > LEVELS[best]) best = r.action;
  }
  return best;
}

export async function requireLevel(db, userId, route, needed) {
  const level = await getPermissionLevel(db, userId, route);
  if (!level || LEVELS[level] < LEVELS[needed]) {
    throw new HttpError(403, `אין הרשאה לביצוע פעולה זו (${route})`);
  }
}

/** Create the two starter groups (admin + default viewer). Returns their ids. */
export async function createStarterGroups(db) {
  const adminGroupId = crypto.randomUUID();
  const viewerGroupId = crypto.randomUUID();
  await db.query(
    `INSERT INTO permission_groups (id, name, is_default) VALUES ($1, 'מנהל מערכת', false), ($2, 'צופה', true)`,
    [adminGroupId, viewerGroupId],
  );
  for (const route of ALL_PAGE_ROUTES) {
    await db.query(
      `INSERT INTO group_page_permissions (group_id, route, action) VALUES ($1, $2, 'admin')`,
      [adminGroupId, route],
    );
    if (route !== '/permissions' && route !== '/settings') {
      await db.query(
        `INSERT INTO group_page_permissions (group_id, route, action) VALUES ($1, $2, 'view')`,
        [viewerGroupId, route],
      );
    }
  }
  return { adminGroupId, viewerGroupId };
}

/**
 * Pick the group(s) for a brand-new user — the same rules the Firebase version
 * applied in ensureUserPermission(): the very first user becomes admin (creating
 * the starter groups if none exist); everyone after gets the default group.
 */
export async function groupsForNewUser(db, isFirstUser) {
  const { rows: groups } = await db.query('SELECT id, name, is_default FROM permission_groups ORDER BY name');
  if (groups.length === 0) {
    const { adminGroupId, viewerGroupId } = await createStarterGroups(db);
    return [isFirstUser ? adminGroupId : viewerGroupId];
  }
  if (isFirstUser) {
    const admin = groups.find((g) => g.name === 'מנהל מערכת');
    return [(admin ?? groups[0]).id];
  }
  const def = groups.find((g) => g.is_default);
  return [(def ?? groups[0]).id];
}
