import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/firebase';

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
 * Upload a file to Firebase Storage and return the download URL.
 * Validates file type and size before uploading.
 */
export function uploadFile(
  file: File,
  path: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  validateFile(file);

  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(percent);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      },
    );
  });
}

/**
 * Delete a file from Firebase Storage by its full URL.
 */
export async function deleteFileByUrl(url: string) {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch {
    // File may not exist, ignore
  }
}
