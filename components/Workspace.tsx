import { useRouter } from 'next/router'
import React, { FunctionComponent, ReactNode, useEffect } from 'react'

import { useAuth } from '../contexts/auth'
import styles from '../styles/Workspace.module.css'
import Header from './Header'

type WorkspaceProps = {
  children: ReactNode
}
const Workspace: FunctionComponent<WorkspaceProps> = ({ children }) => {
  const router = useRouter()
  const { organizationName } = router.query
  const {
    organizationName: userOrganizationName,
    organizationEnabled: userOrganizationEnabled,
  } = useAuth()

  const renderAuthorized =
    organizationName === userOrganizationName && userOrganizationEnabled
  useEffect(() => {
    if (userOrganizationName && !renderAuthorized) {
      // route to home page if user isn't authorized to view this organization
      router.push('/')
    }
  }, [renderAuthorized, userOrganizationName, router])

  return renderAuthorized ? (
    <div className={styles.workspace}>
      <Header />
      {children}
    </div>
  ) : // show nothing if user is not authorized to view this organization
  null
}

export default Workspace
