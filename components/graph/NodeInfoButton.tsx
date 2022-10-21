import { Button } from 'primereact/button'
import { FunctionComponent } from 'react'

import { analytics } from '../../utils/segmentClient'

type NodeInfoButtonProps = {
  nodeData: any
}
const NodeInfoButton: FunctionComponent<NodeInfoButtonProps> = ({
  nodeData,
}) => {
  return (
    nodeData.description && (
      <Button
        id="link-to-detail-button"
        className="p-button-text p-button-lg"
        icon="pi pi-info-circle"
        tooltip={nodeData.description}
        tooltipOptions={{
          position: 'left',
          style: { width: '500px' },
        }}
        onMouseEnter={(e) => {
          analytics.track('view_tooltip', {
            nodeId: nodeData.id,
          })
        }}
      />
    )
  )
}

export default NodeInfoButton