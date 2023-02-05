import { FunctionComponent } from 'react'
import { Node } from 'reactflow'

import { useAuth } from '../../../contexts/auth'
import { useBrowser } from '../../../contexts/browser'
import { analytics } from '../../../utils/segmentClient'
import { MonitoringStatusIndicator } from '../node_detail/MonitoringRulesTable'

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
        id={`${node?.data?.id}-monitoring-status-indicator`}
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
