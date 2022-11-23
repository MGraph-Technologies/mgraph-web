import { Button } from 'primereact/button'
import { FunctionComponent } from 'react'

import { MetricNodeProperties } from './MetricNode'
import { useAuth } from '../../contexts/auth'
import { useBrowser } from '../../contexts/browser'

type MetricNodeAlertBadgeProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodeData: MetricNodeProperties | undefined
}
const MetricNodeAlertBadge: FunctionComponent<MetricNodeAlertBadgeProps> = ({
  nodeData,
}) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()
  return nodeData && nodeData.alert ? (
    <Button
      id="alert-button"
      className="p-button-text p-button-lg p-button-danger"
      icon="pi pi-flag-fill"
      tooltip="A alert is in effect for this metric. Click to view more details."
      tooltipOptions={{
        style: { width: '300px' },
      }}
      onClick={() => push(`/${organizationName}/metrics/${nodeData.id}`)}
    />
  ) : null
}

export default MetricNodeAlertBadge
