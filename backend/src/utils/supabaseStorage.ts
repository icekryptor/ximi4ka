import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy — создаём клиент только при первом обращении, когда dotenv уже загружен
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_KEY || '';
    if (!url || !key) throw new Error('SUPABASE_URL и SUPABASE_SERVICE_KEY должны быть заданы для работы с файлами');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export const BUCKETS = {
  components:  'components',
  employees:   'employees',
  supplyDocs:  'supply-docs',
} as const;

/** Upload buffer to Supabase Storage, return public URL. */
export async function uploadToStorage(
  bucket: string,
  filename: string,
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  const sb = getSupabase();
  const { error } = await sb.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimetype, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = sb.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

/** Delete file from Supabase Storage by its public URL. */
export async function deleteFromStorage(bucket: string, publicUrl: string) {
  try {
    const sb = getSupabase();
    const url = new URL(publicUrl);
    const parts = url.pathname.split(`/object/public/${bucket}/`);
    if (parts.length < 2) return;
    await sb.storage.from(bucket).remove([parts[1]]);
  } catch { /* ignore */ }
}

/** multer memoryStorage — files stay in RAM, we forward to Supabase */
import multer from 'multer';

export const memoryUpload = (limits?: multer.Options['limits'], fileFilter?: multer.Options['fileFilter']) =>
  multer({ storage: multer.memoryStorage(), limits, fileFilter });
