import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const BUCKET_NAME = 'civicpulse-media';
const SIGNED_URL_TTL_SECONDS = 300;
const extensionsByMimeType = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

export async function uploadComplaintImage(file) {
  const extension = extensionsByMimeType[file.mimeType];
  if (!extension) {
    const error = new Error('Unsupported image format');
    error.status = 415;
    throw error;
  }

  const objectKey = `complaints/${randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(objectKey, file.buffer, {
      contentType: file.mimeType,
      upsert: false
    });

  if (error) throw new Error('Cloud media storage operation failed');
  return objectKey;
}

export async function createReadUrl(objectKey, mimeType) {
  if (!extensionsByMimeType[mimeType]) {
    throw new Error('Stored complaint media has an unsupported format');
  }
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) throw new Error('Cloud media URL generation failed');
  return data.signedUrl;
}

export async function deleteObject(objectKey) {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([objectKey]);
  if (error) throw new Error('Cloud media cleanup failed');
}
