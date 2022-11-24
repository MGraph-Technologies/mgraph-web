import { Button } from 'primereact/button'
import { FunctionComponent } from 'react'

import { MetricNodeProperties } from './MetricNode'
import { useAuth } from '../../contexts/auth'
import { useBrowser } from '../../contexts/browser'
import { analytics } from '../../utils/segmentClient'

type MetricNodeAlertBadgeProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodeData: MetricNodeProperties | undefined
}
const MetricNodeAlertBadge: FunctionComponent<MetricNodeAlertBadgeProps> = ({
  nodeData,
}) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()
  if (!nodeData || nodeData.alert === undefined) {
    return null
  } else if (nodeData.alert) {
    return (
      <Button
        id="alert-button"
        className="p-button-text p-button-lg p-button-danger"
        icon="pi pi-flag-fill"
        tooltip="A alert is in effect for this metric. Click to view more details."
        tooltipOptions={{
          style: { width: '300px' },
        }}
        onClick={() => {
          analytics.track('click_metric_node_alert_badge', {
            nodeId: nodeData.id,
          })
          push(`/${organizationName}/metrics/${nodeData.id}#monitoring-rules`)
        }}
      />
    )
  } else {
    return (
      <Button
        id="alert-button"
        className="p-button-text p-button-lg p-button-success"
        icon="pi pi-check-circle"
        tooltip="All monitoring rules are passing for this metric."
        tooltipOptions={{
          style: { width: '300px' },
        }}
      />
    )
  }
}

export default MetricNodeAlertBadge
