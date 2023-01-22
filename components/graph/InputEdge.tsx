import React, { FunctionComponent } from 'react'
import { EdgeProps, getSmoothStepPath } from 'reactFlow'

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
  style = { strokeWidth: 3 },
}) => {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <path id={id} style={style} className="react-flow__edge-path" d={path} />
    </>
  )
}

export default InputEdge
