import { createClient } from '@/lib/supabase/client'

/** Upload a compressed avatar file; returns the storage object path. */
export async function uploadProfileAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const supabase = createClient()
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw new Error(error.message)
  return path
}
