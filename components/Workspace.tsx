import { useRouter } from 'next/router'
import React, { FunctionComponent, ReactNode } from 'react'

import Header from './Header'
import { useAuth } from '../contexts/auth'
import styles from '../styles/Workspace.module.css'

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

  return organizationName === userOrganizationName &&
    userOrganizationEnabled ? (
    <div className={styles.workspace}>
      <Header />
      {children}
    </div>
  ) : // show nothing if user is not authorized to view this organization
  null
}

export default Workspace
