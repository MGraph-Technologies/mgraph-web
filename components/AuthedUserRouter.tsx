import { useRouter } from 'next/router'
import { FunctionComponent, useCallback, useEffect } from 'react'

import { useAuth } from '../contexts/auth'

const AuthedUserRouter: FunctionComponent = () => {
  const router = useRouter()
  const { organizationName, organizationEnabled, authStatePopulated } =
    useAuth()

  const routeToOrganizationIfEnabled = useCallback(() => {
    if (!authStatePopulated) return
    if (organizationName && organizationEnabled) {
      router.push(`/${organizationName}`)
    } else if (organizationName && !organizationEnabled) {
      router.push(`/coming-soon`)
    }
  }, [authStatePopulated, organizationName, organizationEnabled, router])
  useEffect(() => {
    routeToOrganizationIfEnabled()
  }, [routeToOrganizationIfEnabled])

  return <div>Loading...</div>
}

export default AuthedUserRouter
