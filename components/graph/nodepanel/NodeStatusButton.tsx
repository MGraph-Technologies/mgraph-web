import { Button } from 'primereact/button'
import { FunctionComponent } from 'react'
import { Node } from 'reactflow'

import { useAuth } from '../../../contexts/auth'
import { useBrowser } from '../../../contexts/browser'
import { analytics } from '../../../utils/segmentClient'

type NodeStatusButtonProps = {
  node: Node | undefined
}
const NodeStatusButton: FunctionComponent<NodeStatusButtonProps> = ({
  node,
}) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()

  if (node && node.data.monitored) {
    switch (node.data.alert as boolean | undefined) {
      case undefined: {
        return (
          <Button
            id="alert-badge"
            className="p-button-text p-button-lg p-button-warning"
            icon="pi pi-question-circle"
            tooltip="Monitoring is enabled, but no rules have been evaluated yet."
            tooltipOptions={{
              style: { width: '300px' },
            }}
          />
        )
      }
      case false: {
        return (
          <Button
            id="alert-badge"
            className="p-button-text p-button-lg p-button-success"
            icon="pi pi-check-circle"
            tooltip="All monitoring rules are passing."
            tooltipOptions={{
              style: { width: '300px' },
            }}
          />
        )
      }
      case true: {
        return (
          <Button
            id="alert-badge"
            className="p-button-text p-button-lg p-button-danger"
            icon="pi pi-flag-fill"
            tooltip="An alert has resulted from a monitoring rule. Click for more details."
            tooltipOptions={{
              style: { width: '300px' },
            }}
            onClick={() => {
              analytics.track('click_metric_node_alert_badge', {
                nodeId: node.data.id,
              })
              push(
                `/${organizationName}/metrics/${node.data.id}#monitoring-rules`
              )
            }}
          />
        )
      }
    }
  } else {
    return null
  }
}

export default NodeStatusButton
