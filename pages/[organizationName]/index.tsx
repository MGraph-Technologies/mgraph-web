import { FunctionComponent, useState } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import GraphViewer from '../../components/graph/GraphViewer'
import GraphTable from '../../components/graph/GraphTable'
import GraphTableToggleDock from '../../components/graph/GraphTableToggleDock'
import Workspace from '../../components/Workspace'
import styles from '../../styles/OrganizationHome.module.css'

type OrganizationHomeProps = {}
const OrganizationHome: FunctionComponent<OrganizationHomeProps> = () => {
  const [showGraphTable, setShowGraphTable] = useState(false)
  return (
    <Workspace>
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
    </Workspace>
  )
}

export default OrganizationHome
