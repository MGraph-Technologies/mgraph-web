import { useRouter } from 'next/router'
import { FunctionComponent, useCallback, useEffect } from 'react'

import { useAuth } from '../contexts/auth'

type Props = {}

const AuthedUserRouter: FunctionComponent<Props> = () => {
  const router = useRouter()
  const { organizationName, organizationEnabled } = useAuth()

  const routeToOrganizationIfEnabled = useCallback(() => {
    if (organizationName && organizationEnabled) {
      router.push(`/${organizationName}`)
    } else if (organizationName && !organizationEnabled) {
      router.push(`/coming-soon`)
    }
  }, [organizationName, organizationEnabled, router])
  useEffect(() => {
    routeToOrganizationIfEnabled()
  }, [routeToOrganizationIfEnabled])

  return <div>Loading...</div>
}

export default AuthedUserRouter
