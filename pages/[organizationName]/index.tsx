import { useRouter } from 'next/router'
import React, { FunctionComponent, useEffect, useState } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import Account from '../../components/Account'
import GraphViewer from '../../components/GraphViewer/GraphViewer'
import styles from '../../styles/Workspace.module.css'
import { supabase } from '../../utils/supabaseClient'

type WorkspaceProps = {}
const Workspace: FunctionComponent<WorkspaceProps> = () => {
  const router = useRouter()
  const { organizationName } = router.query

  const [organizationId, setOrganizationId] = useState('')
  async function getOrganizationId() {
    if (organizationName) {
      try {
        let { data, error, status } = await supabase
          .from('organizations')
          .select(`id`)
          .filter('name', 'eq', organizationName)
          .single()

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setOrganizationId(data.id)
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }
  useEffect(() => {
    getOrganizationId()
  })

  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div className={styles.mgraph_logo_container}>
          <h1>MGraph</h1>
        </div>
        <div className={styles.user_info_container}>
          <div className={styles.user_organization_logo_container}>
            {organizationName}
          </div>
          <p>&nbsp;&nbsp;&nbsp;</p>
          <div className={styles.user_account_container}>
            <Account />
          </div>
        </div>
      </div>
      <div className={styles.graph_viewer_container}>
        {organizationId === '' ? null : ( // TODO: loading animation
          <ReactFlowProvider>
            <GraphViewer organizationId={organizationId} />
          </ReactFlowProvider>
        )}
      </div>
    </div>
  )
}

export default Workspace
