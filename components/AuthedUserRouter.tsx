import { useRouter } from 'next/router'
import { FunctionComponent, useCallback, useEffect } from 'react'

import { useAuth } from '../contexts/auth'
import { supabase } from '../utils/supabaseClient'

type Props = {}

const AuthedUserRouter: FunctionComponent<Props> = () => {
  const router = useRouter()
  const { organizationName, organizationEnabled } = useAuth()

  const routeToOrganizationIfEnabled = useCallback(() => {
    if (organizationName && organizationEnabled) {
      router.push(`/${organizationName}`)
    } else if (organizationName && !organizationEnabled) {
      router.push(`/coming_soon`)
    }
  }, [organizationName, organizationEnabled, router])
  useEffect(() => {
    routeToOrganizationIfEnabled()
  }, [routeToOrganizationIfEnabled])

  return <div>Loading...</div>
}

export default AuthedUserRouter
