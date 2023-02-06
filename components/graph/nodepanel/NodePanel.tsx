import { FunctionComponent, ReactNode, useEffect, useState } from 'react'
import { Node } from 'reactflow'

import NodeCommentsButton from 'components/graph/nodepanel/NodeCommentsButton'
import NodeGoalsStatusButton from 'components/graph/nodepanel/NodeGoalsStatusButton'
import NodeInfoButton from 'components/graph/nodepanel/NodeInfoButton'
import NodeMonitoringRulesStatusButton from 'components/graph/nodepanel/NodeMonitoringRulesStatusButton'
import { useGraph } from 'contexts/graph'
import styles from 'styles/NodePanel.module.css'

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
