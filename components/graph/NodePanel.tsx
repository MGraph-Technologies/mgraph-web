import { FunctionComponent, ReactNode, useEffect, useState } from 'react'
import { Node } from 'react-flow-renderer'

import { useGraph } from '../../contexts/graph'
import styles from '../../styles/NodePanel.module.css'
import NodeInfoButton from './NodeInfoButton'
import NodeStatusButton from './NodeStatusButton'

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
      <NodeStatusButton node={node} />
      <NodeInfoButton node={node} />
    </div>
  )
}

export default NodePanel
