import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'

import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type authContextType = {
  session: Session | null
}

const authContextTypeValues: authContextType = {
  session: null
}

const AuthContext = createContext<authContextType>(
  authContextTypeValues
)

export function useAuth() {
  return useContext(AuthContext)
}

type AuthProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProps) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    const session = supabase.auth.session()
    setSession(session)

    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event == 'SIGNED_IN' && session && session.user) {
        analytics.identify(session.user.id)
        analytics.track('login')
      }
    })
  }, [])

  const value = { session }
  return (
    <>
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    </>
  )
}
