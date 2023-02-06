import { useRouter } from 'next/router'
import { FunctionComponent, useCallback, useEffect } from 'react'

import { useAuth } from 'contexts/auth'

const AuthedUserRouter: FunctionComponent = () => {
  const router = useRouter()
  const { organizationName, organizationEnabled } = useAuth()

  const routeToOrganizationIfEnabled = useCallback(() => {
    if (!organizationName) return
    if (organizationEnabled) {
      router.push(`/${organizationName}`)
    } else {
      router.push(`/coming-soon`)
    }
  }, [organizationName, organizationEnabled, router])
  useEffect(() => {
    routeToOrganizationIfEnabled()
  }, [routeToOrganizationIfEnabled])

  return <div>Loading...</div>
}

export default AuthedUserRouter
