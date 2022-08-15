import { useRouter } from 'next/router'
import React, { FunctionComponent, ReactNode } from 'react'

import Account from './Account'
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
      <div className={styles.header}>
        <div className={styles.mgraph_logo_container}>
          <h1>MGraph</h1>
        </div>
        <div className={styles.user_info_container}>
          <div className={styles.user_organization_logo_container}>
            {userOrganizationName}
          </div>
          <p>&nbsp;&nbsp;&nbsp;</p>
          <div className={styles.user_account_container}>
            <Account />
          </div>
        </div>
      </div>
      {children}
    </div>
  ) : // show nothing if user is not authorized to view this organization
  null
}

export default Workspace
