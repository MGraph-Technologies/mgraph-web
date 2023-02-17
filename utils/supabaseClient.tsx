import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export const storagePathToSignedUrl = async (path: string) => {
  const splitPath = path.split('/')
  const bucket = splitPath[0]
  const key = splitPath.slice(1).join('/')
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, 60)
  if (error) {
    throw error
  }
  return data.signedUrl
}
