declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_SEGMENT_WRITE_KEY: string
      NEXT_PUBLIC_SUPABASE_URL: string
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string
    }
  }
}

export {}
