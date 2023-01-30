import { FunctionComponent, ReactNode, useEffect, useState } from 'react'
import { Node } from 'reactflow'

import { useGraph } from '../../../contexts/graph'
import styles from '../../../styles/NodePanel.module.css'
import NodeCommentsButton from './NodeCommentsButton'
import NodeGoalsStatusButton from './NodeGoalsStatusButton'
import NodeInfoButton from './NodeInfoButton'
import NodeMonitoringRulesStatusButton from './NodeMonitoringRulesStatusButton'

type NodePanelProps = {
  nodeId: string
  additions?: ReactNode
}
const NodePanel: FunctionComponent<NodePanelProps> = ({
  nodeId,
  additions = null,
}) => {
  const { graph } = useGraph()

  const [node, setNode] = useState<Node | undefined>()
  useEffect(() => {
    setNode(graph.nodes.find((node) => node.id === nodeId))
  }, [graph, nodeId])

  return (
    <div className={styles.menu_container}>
      {additions}
      <NodeGoalsStatusButton node={node} />
      <NodeMonitoringRulesStatusButton node={node} />
      <NodeCommentsButton node={node} />
      <NodeInfoButton node={node} />
    </div>
  )
}

export default NodePanel
