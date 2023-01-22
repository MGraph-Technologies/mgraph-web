import Head from 'next/head'
import { FunctionComponent, useEffect, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'

import { useAuth } from '../../contexts/auth'
import GraphViewer from '../../components/graph/GraphViewer'
import GraphTableViewer from '../../components/graph/GraphTable'
import GraphTableToggleDock from '../../components/graph/GraphTableToggleDock'
import Workspace from '../../components/Workspace'
import styles from '../../styles/OrganizationHome.module.css'

const OrganizationHome: FunctionComponent = () => {
  const { userCanView } = useAuth()
  const [showGraphTable, setShowGraphTable] = useState<boolean | undefined>(
    undefined
  )
  useEffect(() => {
    setShowGraphTable(localStorage.getItem('showGraphTable') === 'true')
  }, [])
  useEffect(() => {
    if (showGraphTable !== undefined) {
      localStorage.setItem('showGraphTable', showGraphTable.toString())
    }
  }, [showGraphTable])

  return (
    <>
      <Head>
        <title>MGraph</title>
      </Head>
      <Workspace>
        {userCanView ? (
          <>
            {showGraphTable !== undefined && (
              <>
                <div className={styles.graph_viewer_container}>
                  {showGraphTable ? (
                    <GraphTableViewer />
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
            )}
          </>
        ) : (
          <div>Please contact your administrator for access.</div>
        )}
      </Workspace>
    </>
  )
}

export default OrganizationHome
