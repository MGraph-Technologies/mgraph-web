import { Button } from 'primereact/button'
import { FunctionComponent, useEffect, useState } from 'react'
import { Node } from 'react-flow-renderer'

import { useAuth } from '../../../contexts/auth'
import { useBrowser } from '../../../contexts/browser'
import { analytics } from '../../../utils/segmentClient'

type NodeInfoButtonProps = {
  node: Node | undefined
}
const NodeInfoButton: FunctionComponent<NodeInfoButtonProps> = ({ node }) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()
  const [linkTo, setLinkTo] = useState('')
  useEffect(() => {
    let _linkTo = ''
    if (organizationName && node !== undefined && node.type === 'metric') {
      _linkTo = '/' + organizationName + '/metrics/' + node.id
    }
    setLinkTo(_linkTo)
  }, [organizationName, node])

  if (node) {
    return (
      <Button
        id="link-to-detail-button"
        className="p-button-text p-button-lg"
        icon="pi pi-info-circle"
        tooltip={node.data.description}
        tooltipOptions={{
          style: { width: '300px' },
        }}
        onClick={(event) => {
          if (!linkTo) return
          push(linkTo)
          event.stopPropagation()
        }}
        onMouseEnter={() => {
          if (node.data.description) {
            analytics.track('view_tooltip', {
              nodeId: node.data.id,
            })
          }
        }}
      />
    )
  } else {
    return null
  }
}

export default NodeInfoButton
