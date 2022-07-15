import { useRouter } from 'next/router'
import React, { FunctionComponent } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import Account from '../components/Account'
import MGraph from '../components/MGraph'
import styles from '../styles/Workspace.module.css'

type WorkspaceProps = {}
const Workspace: FunctionComponent<WorkspaceProps> = () => {
  const router = useRouter()
  const { organization_name } = router.query

  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div className={styles.mgraph_logo_container}>
          <h1>MGraph</h1>
        </div>
        <div className={styles.user_info_container}>
          <div className={styles.user_organization_logo_container}>
            {organization_name}
          </div>
          <p>&nbsp;&nbsp;&nbsp;</p>
          <div className={styles.user_account_container}>
            <Account />
          </div>
        </div>
      </div>
      <div className={styles.mgraph_container}>
        <ReactFlowProvider>
          <MGraph />
        </ReactFlowProvider>
      </div>
    </div>
  )
}

export default Workspace
