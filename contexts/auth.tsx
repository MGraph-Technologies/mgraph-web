import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { Session } from '@supabase/supabase-js'

import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type AuthContextType = {
  session: Session | null
  organizationId: string
  organizationName: string
  organizationEnabled: boolean
  userCanEdit: boolean
  userCanView: boolean
}

const authContextTypeValues: AuthContextType = {
  session: null,
  organizationId: '',
  organizationName: '',
  organizationEnabled: false,
  userCanEdit: false,
  userCanView: false,
}

const AuthContext = createContext<AuthContextType>(authContextTypeValues)

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

  const [organizationId, setOrganizationId] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationEnabled, setOrganizationEnabled] = useState(false)
  const [userCanEdit, setUserCanEdit] = useState(false)
  const [userCanView, setUserCanView] = useState(false)
  const routeToOrganizationIfEnabled = useCallback(async () => {
    if (session?.user?.id) {
      try {
        let { data, error, status } = await supabase
          .from('organization_members')
          .select('organizations ( id, name, enabled ), roles ( name )')
          .is('deleted_at', null)
          .eq('user_id', session?.user?.id || '')
          .single()

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setOrganizationId(data.organizations.id)
          setOrganizationName(data.organizations.name)
          setOrganizationEnabled(data.organizations.enabled)
          const _userCanEdit =
            data.roles.name === 'admin' || data.roles.name === 'editor'
          setUserCanEdit(_userCanEdit)
          setUserCanView(_userCanEdit || data.roles.name === 'viewer')
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }, [session?.user?.id])
  useEffect(() => {
    routeToOrganizationIfEnabled()
  }, [routeToOrganizationIfEnabled])

  const value = {
    session,
    organizationId,
    organizationName,
    organizationEnabled,
    userCanEdit,
    userCanView,
  }
  return (
    <>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </>
  )
}
