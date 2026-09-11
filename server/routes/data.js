import express from 'express';
import { pool, withTransaction } from '../db.js';
import { getResource } from '../resources.js';
import { listCollection, setDocument, updateDocument, deleteDocument, affectedBy } from '../store.js';
import { requireLevel } from '../permissions.js';
import { HttpError } from '../errors.js';
import { broadcast } from '../events.js';

const router = express.Router();
const MAX_OPS = 5000;

// Reads: any signed-in user, as with the Firestore rules. Page-level view
// gating stays in the UI.
router.get('/data/:collection', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await listCollection(pool, req.params.collection));
  } catch (err) {
    next(err);
  }
});

/**
 * Atomic write batch — the single write path (Firestore setDoc / updateDoc /
 * deleteDoc / writeBatch all map onto it). Body: { ops: [{ op, collection, id, data? }] }.
 * Permissions are enforced here per operation, which the Firestore rules never did.
 */
router.post('/batch', async (req, res, next) => {
  try {
    const ops = req.body?.ops;
    if (!Array.isArray(ops) || ops.length === 0) throw new HttpError(400, 'לא נשלחו פעולות');
    if (ops.length > MAX_OPS) throw new HttpError(400, 'יותר מדי פעולות בבקשה אחת');

    const affected = new Set();
    await withTransaction(async (db) => {
      const checked = new Set();
      for (const raw of ops) {
        const { op, collection, id } = raw ?? {};
        const data = raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? { ...raw.data } : {};
        const def = getResource(collection);
        if (!def) throw new HttpError(400, `אוסף לא מוכר: ${collection}`);
        if (!['set', 'update', 'delete'].includes(op)) throw new HttpError(400, `פעולה לא מוכרת: ${op}`);

        const needed = def.writeLevel ?? 'edit';
        const permKey = `${def.route}:${needed}`;
        if (!checked.has(permKey)) {
          await requireLevel(db, req.user.id, def.route, needed);
          checked.add(permKey);
        }

        if (def.appendOnly) {
          if (op !== 'set') throw new HttpError(403, 'יומן השינויים ניתן להוספה בלבד');
          const exists = await db.query(`SELECT 1 FROM ${def.table} WHERE id = $1`, [id]);
          if (exists.rowCount) throw new HttpError(403, 'יומן השינויים ניתן להוספה בלבד');
          // The author is whoever holds the session, not what the client claims.
          data.changedBy = req.user.id;
          data.changedByName = req.user.name || req.user.email;
          data.timestamp = new Date().toISOString();
        }
        delete data.id;

        if (op === 'set') await setDocument(db, collection, id, data);
        else if (op === 'update') await updateDocument(db, collection, id, data);
        else await deleteDocument(db, collection, id);

        for (const c of affectedBy(collection, op)) affected.add(c);
      }
    });

    broadcast(affected);
    res.json({ ok: true, affected: [...affected] });
  } catch (err) {
    next(err);
  }
});

export default router;
