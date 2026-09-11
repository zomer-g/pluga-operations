const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

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

/**
 * Validate file before upload. Throws descriptive error if invalid.
 */
export function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`הקובץ גדול מדי (${(file.size / 1024 / 1024).toFixed(1)}MB). הגודל המרבי הוא 25MB.`);
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`סוג קובץ לא נתמך: ${file.type || 'לא ידוע'}. קבצים נתמכים: PDF, Word, PowerPoint, טקסט, תמונות, וידאו.`);
  }
}

/**
 * Upload a file through the server to R2 and return its app URL (/api/files/...).
 * The server re-validates type and size and chooses the storage key.
 */
export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<string> {
  validateFile(file);

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let payload: { url?: string; error?: string } | null = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload?.url) resolve(payload.url);
      else reject(new Error(payload?.error ?? `העלאת הקובץ נכשלה (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('אין חיבור לשרת — העלאת הקובץ נכשלה'));
    xhr.send(form);
  });
}

/**
 * Delete an uploaded file by its app URL.
 */
export async function deleteFileByUrl(url: string) {
  if (!url.startsWith('/api/files/')) return;
  try {
    await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    // File may not exist, ignore
  }
}
