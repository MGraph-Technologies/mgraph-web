import Head from 'next/head'
import { FunctionComponent, useEffect, useState } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import { useAuth } from '../../contexts/auth'
import GraphViewer from '../../components/graph/GraphViewer'
import GraphTableViewer from '../../components/graph/GraphTable'
import GraphTableToggleDock from '../../components/graph/GraphTableToggleDock'
import Workspace from '../../components/Workspace'
import styles from '../../styles/OrganizationHome.module.css'

type OrganizationHomeProps = {}
const OrganizationHome: FunctionComponent<OrganizationHomeProps> = () => {
  const { userCanView } = useAuth()
  const [showGraphTable, setShowGraphTable] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  useEffect(() => {
    setShowGraphTable(localStorage.getItem('showGraphTable') === 'true')
    setInitialLoadComplete(true)
  }, [])
  useEffect(() => {
    if (initialLoadComplete) {
      localStorage.setItem('showGraphTable', showGraphTable.toString())
    }
  }, [initialLoadComplete, showGraphTable])

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
        ) : (
          <div>Please contact your administrator for access.</div>
        )}
      </Workspace>
    </>
  )
}

export default OrganizationHome
