/* sourced from here: 
https://github.com/supabase/supabase/discussions/6177 */
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient
const sessions: { [key: string]: Session | null } = {}

export default async function getSession({
  email,
  password,
  supabaseUrl,
  supabaseAnonKey,
}: {
  email: string
  password: string
  supabaseUrl: string
  supabaseAnonKey: string
}) {
  // If there's already a supabase client, use it, don't create a new one.
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
  }

  // Create a session for the user if it doesn't exist already.
  // You can then log in as any number of test users from your tests.
  if (!sessions[email]) {
    const res = await supabase.auth.signIn({
      email,
      password,
    })

    sessions[email] = res.session
  }

  return sessions[email]
}
