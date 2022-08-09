import { useRouter } from 'next/router'
import React, { FunctionComponent } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import Account from '../../components/Account'
import GraphViewer from '../../components/GraphViewer/GraphViewer'
import { useAuth } from '../../contexts/auth'
import styles from '../../styles/Workspace.module.css'

type WorkspaceProps = {}
const Workspace: FunctionComponent<WorkspaceProps> = () => {
  const router = useRouter()
  const { organizationName } = router.query
  const { organizationName: userOrganizationName, organizationEnabled: userOrganizationEnabled } = useAuth()

  return (
    organizationName === userOrganizationName && userOrganizationEnabled ? (
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
        <div className={styles.graph_viewer_container}>
          <ReactFlowProvider>
            <GraphViewer />
          </ReactFlowProvider>
        </div>
      </div>
    ) : (
      null
    )
  )
}

export default Workspace
