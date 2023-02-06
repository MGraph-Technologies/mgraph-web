import { Session } from '@supabase/supabase-js'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

type AuthContextType = {
  session: Session | null | undefined
  getValidAccessToken: () => string | null
  organizationId: string
  organizationEnabled: boolean
  organizationLogoStoragePath: string
  organizationName: string
  userRole: string
  userIsAdmin: boolean
  userCanEdit: boolean
  userCanView: boolean
  userOnMobile: boolean
}

const authContextTypeValues: AuthContextType = {
  session: null,
  getValidAccessToken: () => null,
  organizationId: '',
  organizationEnabled: false,
  organizationLogoStoragePath: '',
  organizationName: '',
  userRole: '',
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
  const [organizationEnabled, setOrganizationEnabled] = useState(false)
  const [organizationLogoStoragePath, setOrganizationLogoStoragePath] =
    useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [userIsAdmin, setUserIsAdmin] = useState(false)
  const [userCanEdit, setUserCanEdit] = useState(false)
  const [userCanView, setUserCanView] = useState(false)
  const [userOnMobile, setUserOnMobile] = useState(false)
  const populateAuthState = useCallback(async () => {
    if (session?.user?.id) {
      try {
        const { data, error, status } = await supabase
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
          setOrganizationEnabled(data.organizations.enabled)
          setOrganizationLogoStoragePath(data.organizations.logo_storage_path)
          setOrganizationName(data.organizations.name)
          const _userRole = data.roles.name
          setUserRole(_userRole)
          const _userIsAdmin = _userRole === 'admin'
          setUserIsAdmin(_userIsAdmin)
          const _userCanEdit = _userIsAdmin || _userRole === 'editor'
          setUserCanEdit(_userCanEdit)
          const _userCanView = _userCanEdit || _userRole === 'viewer'
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
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [session?.user?.id, session?.user?.email])
  useEffect(() => {
    populateAuthState()
  }, [populateAuthState])

  const getValidAccessToken = useCallback(() => {
    const accessToken = session?.access_token
    const expiresAt = (session?.expires_at || 0) * 1000
    if (accessToken && expiresAt && new Date(expiresAt) > new Date()) {
      return accessToken
    } else {
      return null
    }
  }, [session?.access_token, session?.expires_at])

  const value = {
    session,
    getValidAccessToken,
    organizationId,
    organizationEnabled,
    organizationLogoStoragePath,
    organizationName,
    userRole,
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
