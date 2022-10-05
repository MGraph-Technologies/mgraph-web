import { Session } from '@supabase/supabase-js'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type AuthContextType = {
  session: Session | null | undefined
  organizationId: string
  organizationName: string
  organizationLogoStoragePath: string
  organizationEnabled: boolean
  userIsAdmin: boolean
  userCanEdit: boolean
  userCanView: boolean
  userOnMobile: boolean
}

const authContextTypeValues: AuthContextType = {
  session: null,
  organizationId: '',
  organizationName: '',
  organizationLogoStoragePath: '',
  organizationEnabled: false,
  userIsAdmin: false,
  userCanEdit: false,
  userCanView: false,
  userOnMobile: false,
}

const AuthContext = createContext<AuthContextType>(authContextTypeValues)

export function useAuth() {
  return useContext(AuthContext)
}

type AuthProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    const session = supabase.auth.session()
    setSession(session)

    supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
    })
  }, [])

  const [organizationId, setOrganizationId] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationLogoStoragePath, setOrganizationLogoStoragePath] =
    useState('')
  const [organizationEnabled, setOrganizationEnabled] = useState(false)
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [userCanEdit, setUserCanEdit] = useState(false)
  const [userCanView, setUserCanView] = useState(false)
  const [userOnMobile, setUserOnMobile] = useState(false)
  const populateAuthState = useCallback(async () => {
    if (session?.user) {
      try {
        let { data, error, status } = await supabase
          .from('organization_members')
          .select(
            'organizations ( id, name, logo_storage_path, enabled ), roles ( name )'
          )
          .is('deleted_at', null)
          .eq('user_id', session.user.id || '')
          .single()

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setOrganizationId(data.organizations.id)
          setOrganizationName(data.organizations.name)
          setOrganizationLogoStoragePath(data.organizations.logo_storage_path)
          setOrganizationEnabled(data.organizations.enabled)
          const _userIsAdmin = data.roles.name === 'admin'
          setUserIsAdmin(_userIsAdmin)
          const _userCanEdit = _userIsAdmin || data.roles.name === 'editor'
          setUserCanEdit(_userCanEdit)
          const _userCanView = _userCanEdit || data.roles.name === 'viewer'
          setUserCanView(_userCanView)
          setUserOnMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))

          analytics.identify(session.user.id, {
            email: session.user.email,
            organization_id: data.organizations.id,
            organization_name: data.organizations.name,
            is_admin: _userIsAdmin,
            can_edit: _userCanEdit,
            can_view: _userCanView,
          })
          analytics.track('login')
        }
      } catch (error: any) {
        console.error(error.message)
      }
    }
  }, [session?.user])
  useEffect(() => {
    populateAuthState()
  }, [populateAuthState])

  const value = {
    session,
    organizationId,
    organizationName,
    organizationLogoStoragePath,
    organizationEnabled,
    userIsAdmin,
    userCanEdit,
    userCanView,
    userOnMobile,
  }
  return (
    <>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </>
  )
}
