import React, { FunctionComponent } from 'react'
import { EdgeProps, getBezierPath } from 'react-flow-renderer'

export type InputEdgeProperties = {
  // TODO: figure out how to reference this in InputEdge's type
  id: string
  organizationId: string
  typeId: string
  sourceId: string
  targetId: string
  // below not in postgres
  initialProperties: object
}
const InputEdge: FunctionComponent<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
}) => {
  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
      />
    </>
  )
}

export default InputEdge
