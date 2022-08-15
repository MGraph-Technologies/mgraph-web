import { FunctionComponent } from 'react'
import { ReactFlowProvider } from 'react-flow-renderer'

import GraphViewer from '../../components/GraphViewer/GraphViewer'
import Workspace from '../../components/Workspace'
import styles from '../../styles/OrganizationHome.module.css'

type OrganizationHomeProps = {}
const OrganizationHome: FunctionComponent<OrganizationHomeProps> = () => {
  return (
    <Workspace>
      <div className={styles.graph_viewer_container}>
          <ReactFlowProvider>
            <GraphViewer />
          </ReactFlowProvider>
      </div>
    </Workspace>
  )
}

export default OrganizationHome
