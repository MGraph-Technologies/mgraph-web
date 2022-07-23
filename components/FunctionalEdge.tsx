import React, { FunctionComponent } from 'react'
import { EdgeProps, getBezierPath } from 'react-flow-renderer'

export type FunctionalEdgeDataType = { // TODO: figure out how to reference this in FunctionalEdge's type
  type: string,
  typeId: string,
  organizationId: string,
}
const FunctionalEdge: FunctionComponent<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {}
}) => {
  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

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

export default FunctionalEdge