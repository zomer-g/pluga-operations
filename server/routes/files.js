import crypto from 'node:crypto';
import express from 'express';
import busboy from 'busboy';
import { pool } from '../db.js';
import { requireLevel } from '../permissions.js';
import { HttpError } from '../errors.js';
import { r2Configured, putObject, signedGetUrl, deleteObject } from '../r2.js';

const router = express.Router();

// Same limits the Firebase Storage rules enforced (see src/lib/storage.ts).
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'text/plain',
  'text/rtf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

const KEY_RE = /^(training|profiles)\/[^\0]{1,512}$/;

function objectKey(req) {
  const key = req.params[0];
  if (!KEY_RE.test(key) || key.split('/').includes('..')) throw new HttpError(400, 'נתיב קובץ לא תקין');
  return key;
}

function safeName(name) {
  const cleaned = String(name || 'file').normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-120);
  return cleaned || 'file';
}

router.post('/files', async (req, res, next) => {
  try {
    await requireLevel(pool, req.user.id, '/training', 'edit');
    if (!r2Configured()) throw new HttpError(503, 'אחסון קבצים (R2) לא הוגדר בשרת');
  } catch (err) {
    return next(err);
  }

  let bb;
  try {
    bb = busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE_SIZE, fields: 5 } });
  } catch {
    return next(new HttpError(400, 'בקשת העלאה לא תקינה'));
  }

  let handled = false;
  let sawFile = false;
  const fail = (err) => {
    if (handled) return;
    handled = true;
    req.unpipe(bb);
    req.resume();
    next(err);
  };

  bb.on('file', (_field, stream, info) => {
    sawFile = true;
    if (!ALLOWED_MIME_TYPES.has(info.mimeType)) {
      stream.resume();
      return fail(new HttpError(415, `סוג קובץ לא נתמך: ${info.mimeType || 'לא ידוע'}`));
    }
    const key = `training/${new Date().getFullYear()}/${crypto.randomUUID()}/${safeName(info.filename)}`;
    let tooBig = false;
    stream.on('limit', () => { tooBig = true; });

    putObject(key, stream, info.mimeType)
      .then(async () => {
        if (tooBig) {
          await deleteObject(key).catch(() => {});
          return fail(new HttpError(413, 'הקובץ גדול מדי. הגודל המרבי הוא 25MB.'));
        }
        if (handled) return;
        handled = true;
        res.json({ url: `/api/files/${key}` });
      })
      .catch((err) => {
        console.error('[files] upload failed', err);
        fail(new HttpError(502, 'העלאת הקובץ נכשלה'));
      });
  });
  bb.on('error', () => fail(new HttpError(400, 'בקשת העלאה לא תקינה')));
  bb.on('close', () => {
    if (!sawFile) fail(new HttpError(400, 'לא נשלח קובץ'));
  });
  req.pipe(bb);
});

router.get('/files/*', async (req, res, next) => {
  try {
    if (!r2Configured()) throw new HttpError(503, 'אחסון קבצים (R2) לא הוגדר בשרת');
    const key = objectKey(req);
    res.set('Cache-Control', 'private, no-store');
    res.redirect(302, await signedGetUrl(key, key.split('/').pop()));
  } catch (err) {
    next(err);
  }
});

router.delete('/files/*', async (req, res, next) => {
  try {
    await requireLevel(pool, req.user.id, '/training', 'edit');
    if (!r2Configured()) throw new HttpError(503, 'אחסון קבצים (R2) לא הוגדר בשרת');
    await deleteObject(objectKey(req));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
