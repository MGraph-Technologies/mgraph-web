import Head from 'next/head'
import { FunctionComponent, useState } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import { useAuth } from '../../contexts/auth'
import GraphViewer from '../../components/graph/GraphViewer'
import GraphTable from '../../components/graph/GraphTable'
import GraphTableToggleDock from '../../components/graph/GraphTableToggleDock'
import Workspace from '../../components/Workspace'
import styles from '../../styles/OrganizationHome.module.css'

type OrganizationHomeProps = {}
const OrganizationHome: FunctionComponent<OrganizationHomeProps> = () => {
  const { userCanView } = useAuth()
  const [showGraphTable, setShowGraphTable] = useState(false)
  return (
    <>
      <Head>
        <title>MGraph</title>
      </Head>
      <Workspace>
        {userCanView ? (
          <>
            <div className={styles.graph_viewer_container}>
              {showGraphTable ? (
                <GraphTable />
              ) : (
                <ReactFlowProvider>
                  <GraphViewer />
                </ReactFlowProvider>
              )}
            </div>
            <GraphTableToggleDock
              showGraphTable={showGraphTable}
              setShowGraphTable={setShowGraphTable}
            />
          </>
        ) : (
          <div>Please contact your administrator for access.</div>
        )}
      </Workspace>
    </>
  )
}

export default OrganizationHome
