import { useRouter } from 'next/router'
import { FunctionComponent } from 'react'

import NodeDetail from '../../../components/graph/node_detail/NodeDetail'
import Workspace from '../../../components/Workspace'
import styles from '../../../styles/NodeDetailPage.module.css'

const NodeDetailPage: FunctionComponent = () => {
  const router = useRouter()
  const { nodeId } = router.query
  return (
    // head populated by MetricDetail
    <Workspace>
      <div className={styles.node_detail_container}>
        {typeof nodeId === 'string' && nodeId && <NodeDetail nodeId={nodeId} />}
      </div>
    </Workspace>
  )
}

export default NodeDetailPage
