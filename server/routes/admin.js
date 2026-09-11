import crypto from 'node:crypto';
import express from 'express';
import { pool, withTransaction } from '../db.js';
import { RESOURCES, COLLECTION_ORDER } from '../resources.js';
import { listCollection, setDocument, allCollectionNames } from '../store.js';
import { requireLevel, createStarterGroups } from '../permissions.js';
import { reattachSessions } from '../auth.js';
import { HttpError } from '../errors.js';
import { broadcast } from '../events.js';
import { r2Configured, putObject } from '../r2.js';

const router = express.Router();

const DATA_TABLES = [
  'donations', 'training_content_tags', 'training_content', 'training_tags', 'training_categories',
  'routine_change_logs', 'routine_crew_slots', 'routine_templates', 'routine_vehicles', 'routine_departments',
  'assignments', 'shampaf_vacations', 'shampaf_entries', 'activations',
  'tank_crew_assignments', 'tanks', 'departments',
  'equipment_assignments', 'equipment_types', 'status_entries',
  'squads', 'soldiers', 'platoons',
  'user_page_overrides', 'user_groups', 'group_page_permissions', 'permission_groups',
];

const ID_RE = /^[A-Za-z0-9_\-:.]{1,128}$/;
const DANGEROUS_FIELDS = new Set(['__proto__', 'constructor', 'prototype']);

router.use(async (req, res, next) => {
  try {
    await requireLevel(pool, req.user.id, '/settings', 'admin');
    next();
  } catch (err) {
    next(err);
  }
});

// ===== Export (same file format as the Firebase version: version 3) =====

router.get('/backup', async (req, res, next) => {
  try {
    const tables = {};
    for (const name of COLLECTION_ORDER) tables[name] = await listCollection(pool, name);
    res.set('Cache-Control', 'no-store');
    res.json({ version: 3, exportDate: new Date().toISOString(), tables });
  } catch (err) {
    next(err);
  }
});

// ===== Restore =====

function sanitize(tables) {
  const report = { skipped: 0, detachedRefs: 0 };
  const clean = {};

  for (const name of COLLECTION_ORDER) {
    const rows = Array.isArray(tables?.[name]) ? tables[name] : [];
    const seen = new Set();
    clean[name] = [];
    for (const item of rows) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !ID_RE.test(item.id) || seen.has(item.id)) {
        report.skipped++;
        continue;
      }
      seen.add(item.id);
      const record = {};
      for (const [k, v] of Object.entries(item)) if (!DANGEROUS_FIELDS.has(k)) record[k] = v;
      if (name === 'userPermissions') {
        if (!Array.isArray(record.groupIds)) record.groupIds = record.groupId ? [record.groupId] : [];
        delete record.groupId;
        if (typeof record.email !== 'string' || !record.email) { report.skipped++; continue; }
      }
      clean[name].push(record);
    }
  }

  // Unique emails (users.email is unique, case-insensitive).
  const emails = new Set();
  clean.userPermissions = clean.userPermissions.filter((u) => {
    const e = u.email.toLowerCase();
    if (emails.has(e)) { report.skipped++; return false; }
    emails.add(e);
    return true;
  });

  // Firestore never enforced references. Detach optional dangling references
  // and drop records whose required parent is gone, repeating until stable
  // (dropping a record can orphan its own children).
  for (let changed = true; changed;) {
    changed = false;
    const ids = Object.fromEntries(COLLECTION_ORDER.map((n) => [n, new Set(clean[n].map((r) => r.id))]));
    for (const name of COLLECTION_ORDER) {
      const def = RESOURCES[name];
      clean[name] = clean[name].filter((record) => {
        for (const [field, meta] of Object.entries(def.fields)) {
          if (!meta.ref) continue;
          const v = record[field];
          if (v === undefined || v === null || v === '') continue;
          if (ids[meta.ref].has(v)) continue;
          if (meta.required) { report.skipped++; changed = true; return false; }
          delete record[field];
          report.detachedRefs++;
        }
        for (const child of def.children ?? []) {
          const value = record[child.field];
          if (child.kind === 'list' && Array.isArray(value)) {
            record[child.field] = value.filter((item) => Object.entries(child.columns).every(([n, c]) => {
              if (!c.ref || item?.[n] === undefined || item?.[n] === '') return true;
              const ok = ids[c.ref].has(item[n]);
              if (!ok) report.detachedRefs++;
              return ok;
            }));
          } else if (child.kind === 'scalarList' && child.ref && Array.isArray(value)) {
            record[child.field] = value.filter((v) => {
              const ok = ids[child.ref].has(v);
              if (!ok) report.detachedRefs++;
              return ok;
            });
          }
        }
        return true;
      });
    }
  }
  return { clean, report };
}

async function migrateFirebaseFiles() {
  const result = { copied: 0, failed: 0, pending: 0 };
  const firebaseUrl = /^https:\/\/(firebasestorage\.googleapis\.com|storage\.googleapis\.com)\//;
  const targets = [
    ...(await pool.query(`SELECT id, file_url AS url, 'training_content' AS tbl, 'file_url' AS col FROM training_content WHERE file_url ~ '^https://(firebasestorage|storage)\\.googleapis\\.com/'`)).rows,
    ...(await pool.query(`SELECT id, profile_image_url AS url, 'soldiers' AS tbl, 'profile_image_url' AS col FROM soldiers WHERE profile_image_url ~ '^https://(firebasestorage|storage)\\.googleapis\\.com/'`)).rows,
  ].filter((t) => firebaseUrl.test(t.url));

  if (!r2Configured()) {
    result.pending = targets.length;
    return result;
  }
  for (const t of targets) {
    try {
      const response = await fetch(t.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      const objectPath = decodeURIComponent(new URL(t.url).pathname.split('/o/')[1] ?? '');
      const fileName = (objectPath.split('/').pop() || 'file').replace(/[^\p{L}\p{N}._-]+/gu, '_');
      const folder = t.tbl === 'soldiers' ? 'profiles' : 'training';
      const key = `${folder}/migrated/${crypto.randomUUID()}/${fileName}`;
      await putObject(key, body, response.headers.get('content-type') || 'application/octet-stream');
      await pool.query(`UPDATE ${t.tbl} SET ${t.col} = $2 WHERE id = $1`, [t.id, `/api/files/${key}`]);
      result.copied++;
    } catch (err) {
      console.error('[restore] file copy failed', t.id, err.message);
      result.failed++;
    }
  }
  return result;
}

router.post('/restore', async (req, res, next) => {
  try {
    const backup = req.body;
    if (typeof backup?.version !== 'number' || typeof backup.tables !== 'object' || backup.tables === null) {
      throw new HttpError(400, 'קובץ גיבוי לא תקין — חסרים שדות version או tables');
    }
    const { clean, report } = sanitize(backup.tables);
    const counts = {};

    await withTransaction(async (db) => {
      const { rows: liveSessions } = await db.query(
        `SELECT s.*, lower(u.email) AS email, u.google_sub, u.picture
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.revoked_at IS NULL AND s.expires_at > now()`,
      );
      await db.query(`TRUNCATE ${[...DATA_TABLES, 'users', 'sessions'].join(', ')} CASCADE`);

      for (const name of COLLECTION_ORDER) {
        for (const record of clean[name]) {
          const { id, ...data } = record;
          try {
            await setDocument(db, name, id, data);
          } catch (err) {
            err.message = `${name}/${id}: ${err.message}`;
            throw err;
          }
        }
        counts[name] = clean[name].length;
      }
      await reattachSessions(db, liveSessions);
    });

    const files = await migrateFirebaseFiles();
    broadcast(allCollectionNames());

    const parts = ['הנתונים יובאו בהצלחה'];
    if (report.skipped) parts.push(`${report.skipped} רשומות לא תקינות או יתומות דולגו`);
    if (report.detachedRefs) parts.push(`${report.detachedRefs} קישורים לרשומות חסרות נוקו`);
    if (files.copied) parts.push(`${files.copied} קבצים הועתקו ל-R2`);
    if (files.failed) parts.push(`${files.failed} קבצים לא הועתקו`);
    if (files.pending) parts.push(`${files.pending} קבצים עדיין ב-Firebase (R2 לא מוגדר)`);
    res.json({ success: true, message: parts.join(' · '), counts, report, files });
  } catch (err) {
    console.error('[restore] failed', err);
    res.status(err instanceof HttpError ? err.status : 400).json({
      success: false,
      message: `הייבוא נכשל ולא בוצע שינוי: ${err.message}`,
    });
  }
});

// ===== Clear all data =====

router.post('/clear', async (req, res, next) => {
  try {
    await withTransaction(async (db) => {
      await db.query(`TRUNCATE ${DATA_TABLES.join(', ')} CASCADE`);
      // Re-create the starter groups so nobody is locked out: whoever cleared
      // becomes admin, every other user falls back to the default viewer group.
      const { adminGroupId, viewerGroupId } = await createStarterGroups(db);
      await db.query(
        `INSERT INTO user_groups (user_id, position, group_id)
         SELECT id, 0, CASE WHEN id = $1 THEN $2 ELSE $3 END FROM users`,
        [req.user.id, adminGroupId, viewerGroupId],
      );
    });
    broadcast(allCollectionNames());
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
