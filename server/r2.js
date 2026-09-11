import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Uploaded files live in Cloudflare R2 (S3-compatible). The bucket stays
// private: the app hands out short-lived signed URLs to signed-in users only.

let client = null;

export function r2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET,
  );
}

function s3() {
  if (!r2Configured()) throw new Error('R2 storage is not configured');
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function putObject(key, body, contentType) {
  const upload = new Upload({
    client: s3(),
    params: { Bucket: process.env.R2_BUCKET, Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
}

export async function signedGetUrl(key, fileName) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ResponseContentDisposition: fileName ? `inline; filename*=UTF-8''${encodeURIComponent(fileName)}` : undefined,
  });
  return getSignedUrl(s3(), command, { expiresIn: 300 });
}

export async function deleteObject(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}
