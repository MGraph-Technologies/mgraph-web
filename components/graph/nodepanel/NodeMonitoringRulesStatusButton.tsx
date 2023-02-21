import { FunctionComponent } from 'react'
import { Node } from 'reactflow'

import { MonitoringStatusIndicator } from 'components/graph/node_detail/MonitoringRulesTable'
import { useAuth } from 'contexts/auth'
import { useBrowser } from 'contexts/browser'
import { analytics } from 'utils/segmentClient'

type NodeMonitoringRulesStatusButtonProps = {
  node: Node | undefined
}
const NodeMonitoringRulesStatusButton: FunctionComponent<
  NodeMonitoringRulesStatusButtonProps
> = ({ node }) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()

  if (node && node.data.monitored) {
    return (
      <MonitoringStatusIndicator
        id={`monitoring-status-indicator-${node?.data?.id}`}
        alert={node.data.alert}
        onClick={() => {
          analytics.track('click_metric_node_alert_badge', {
            nodeId: node.data.id,
            type: 'monitoring',
          })
          push(`/${organizationName}/nodes/${node.data.id}#monitoring-rules`)
        }}
      />
    )
  } else {
    return null
  }
}

export default NodeMonitoringRulesStatusButton
