import { RESOURCES, getResource } from './resources.js';
import { HttpError } from './errors.js';

const ID_RE = /^[A-Za-z0-9_\-:.]{1,128}$/;
const MAX_TEXT = 200_000;

const key = (col) => col.replace(/"/g, '');

// ===== Reading =====

function rowToDoc(def, row) {
  const doc = { id: row.id };
  for (const [name, field] of Object.entries(def.fields)) {
    const v = row[key(field.col)];
    if (v !== null && v !== undefined) doc[name] = v;
  }
  for (const [name, parts] of Object.entries(def.composites ?? {})) {
    const obj = {};
    for (const [sub, col] of Object.entries(parts)) {
      if (row[col] !== null && row[col] !== undefined) obj[sub] = row[col];
    }
    if (Object.keys(obj).length > 0) doc[name] = obj;
  }
  return doc;
}

export async function listCollection(db, name) {
  const def = getResource(name);
  if (!def) throw new HttpError(404, `unknown collection: ${name}`);

  const { rows } = await db.query(`SELECT * FROM ${def.table} ORDER BY ${def.order ?? 'id'}`);
  const docs = rows.map((r) => rowToDoc(def, r));
  const byId = new Map(docs.map((d) => [d.id, d]));

  for (const child of def.children ?? []) {
    for (const d of docs) d[child.field] = child.kind === 'map' ? {} : [];
    const orderBy = child.kind === 'map' ? child.keyCol : 'position';
    const { rows: childRows } = await db.query(
      `SELECT * FROM ${child.table} ORDER BY ${child.fk}, ${orderBy}`,
    );
    for (const cr of childRows) {
      const parent = byId.get(cr[child.fk]);
      if (!parent) continue;
      if (child.kind === 'list') {
        const item = {};
        for (const [n, c] of Object.entries(child.columns)) {
          if (cr[c.col] !== null) item[n] = cr[c.col];
        }
        parent[child.field].push(item);
      } else if (child.kind === 'scalarList') {
        parent[child.field].push(cr[child.col]);
      } else {
        parent[child.field][cr[child.keyCol]] = cr[child.valueCol];
      }
    }
  }
  return docs;
}

// ===== Writing =====

function toDbValue(field, value, path) {
  if (value === undefined || value === null) return null;
  const emptyIsNull = field.ref || field.type !== 'text';
  if (value === '' && emptyIsNull) return null;

  switch (field.type) {
    case 'int':
    case 'num': {
      const n = typeof value === 'number' ? value : Number(value);
      if (!Number.isFinite(n)) throw new HttpError(400, `ערך מספרי לא תקין בשדה ${path}`);
      return field.type === 'int' ? Math.trunc(n) : n;
    }
    case 'bool':
      return value === true || value === 'true';
    default:
      if (typeof value === 'object') throw new HttpError(400, `ערך לא תקין בשדה ${path}`);
      {
        const s = String(value);
        if (s.length > MAX_TEXT) throw new HttpError(400, `ערך ארוך מדי בשדה ${path}`);
        return s;
      }
  }
}

function assertId(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new HttpError(400, 'מזהה רשומה לא תקין');
}

async function replaceChildren(db, def, id, data) {
  for (const child of def.children ?? []) {
    if (!(child.field in data)) continue;
    const value = data[child.field];
    await db.query(`DELETE FROM ${child.table} WHERE ${child.fk} = $1`, [id]);
    if (value === null || value === undefined) continue;

    if (child.kind === 'list') {
      if (!Array.isArray(value)) throw new HttpError(400, `השדה ${child.field} חייב להיות רשימה`);
      let position = 0;
      for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const cols = [child.fk, 'position'];
        const vals = [id, position++];
        for (const [n, c] of Object.entries(child.columns)) {
          cols.push(c.col);
          vals.push(toDbValue(c, item[n], `${child.field}.${n}`));
        }
        await db.query(
          `INSERT INTO ${child.table} (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`,
          vals,
        );
      }
    } else if (child.kind === 'scalarList') {
      if (!Array.isArray(value)) throw new HttpError(400, `השדה ${child.field} חייב להיות רשימה`);
      const seen = new Set();
      let position = 0;
      for (const raw of value) {
        if (raw === null || raw === undefined || raw === '') continue;
        const v = String(raw);
        if (seen.has(v)) continue;
        seen.add(v);
        await db.query(
          `INSERT INTO ${child.table} (${child.fk}, position, ${child.col}) VALUES ($1, $2, $3)`,
          [id, position++, v],
        );
      }
    } else {
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new HttpError(400, `השדה ${child.field} חייב להיות אובייקט`);
      }
      for (const [k, v] of Object.entries(value)) {
        if (v === null || v === undefined || v === '') continue;
        await db.query(
          `INSERT INTO ${child.table} (${child.fk}, ${child.keyCol}, ${child.valueCol}) VALUES ($1, $2, $3)`,
          [id, String(k), String(v)],
        );
      }
    }
  }
}

/** Full replace (Firestore setDoc). Columns absent from `data` fall back to their DEFAULT. */
export async function setDocument(db, name, id, data) {
  const def = getResource(name);
  assertId(id);
  const cols = [];
  const exprs = [];
  const vals = [id];

  const push = (col, field, value, path) => {
    cols.push(col);
    if (value === undefined) {
      exprs.push('DEFAULT');
    } else {
      vals.push(toDbValue(field, value, path));
      exprs.push(`$${vals.length}`);
    }
  };

  for (const [n, field] of Object.entries(def.fields)) push(field.col, field, data[n], n);
  for (const [n, parts] of Object.entries(def.composites ?? {})) {
    const obj = data[n] && typeof data[n] === 'object' ? data[n] : {};
    for (const [sub, col] of Object.entries(parts)) push(col, { type: 'text' }, obj[sub] ?? undefined, `${n}.${sub}`);
  }

  const updates = cols.map((c) => `${c} = EXCLUDED.${c}`);
  await db.query(
    `INSERT INTO ${def.table} (id${cols.map((c) => `, ${c}`).join('')})
     VALUES ($1${exprs.map((e) => `, ${e}`).join('')})
     ON CONFLICT (id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`,
    vals,
  );
  const withChildren = { ...data };
  for (const child of def.children ?? []) {
    if (!(child.field in withChildren)) withChildren[child.field] = child.kind === 'map' ? {} : [];
  }
  await replaceChildren(db, def, id, withChildren);
}

/** Partial update (Firestore updateDoc). Fails if the row does not exist. */
export async function updateDocument(db, name, id, data) {
  const def = getResource(name);
  assertId(id);
  const sets = [];
  const vals = [id];

  for (const [n, field] of Object.entries(def.fields)) {
    if (!(n in data) || data[n] === undefined) continue;
    vals.push(toDbValue(field, data[n], n));
    sets.push(`${field.col} = $${vals.length}`);
  }
  for (const [n, parts] of Object.entries(def.composites ?? {})) {
    if (!(n in data)) continue;
    const obj = data[n] && typeof data[n] === 'object' ? data[n] : {};
    for (const [sub, col] of Object.entries(parts)) {
      vals.push(toDbValue({ type: 'text' }, obj[sub], `${n}.${sub}`));
      sets.push(`${col} = $${vals.length}`);
    }
  }

  const sql = sets.length
    ? `UPDATE ${def.table} SET ${sets.join(', ')} WHERE id = $1`
    : `SELECT 1 FROM ${def.table} WHERE id = $1`;
  const { rowCount } = await db.query(sql, vals);
  if (rowCount === 0) throw new HttpError(404, 'הרשומה לא נמצאה (ייתכן שנמחקה)');
  await replaceChildren(db, def, id, data);
}

export async function deleteDocument(db, name, id) {
  const def = getResource(name);
  assertId(id);
  if (name === 'routineTemplates') {
    // History rows carry no FK; keep the app's behaviour of dropping them with the template.
    await db.query('DELETE FROM routine_change_logs WHERE template_id = $1', [id]);
  } else if (name === 'routineVehicles') {
    await db.query(
      'DELETE FROM routine_change_logs WHERE template_id IN (SELECT id FROM routine_templates WHERE vehicle_id = $1)',
      [id],
    );
  }
  await db.query(`DELETE FROM ${def.table} WHERE id = $1`, [id]);
}

/** Collections whose snapshot may change when `name` changes (for live updates). */
export function affectedBy(name, op) {
  const def = getResource(name);
  const out = new Set([name]);
  if (op === 'delete') for (const d of def.dependents ?? []) out.add(d);
  return out;
}

export function allCollectionNames() {
  return Object.keys(RESOURCES);
}
