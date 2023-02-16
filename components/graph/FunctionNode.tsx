import React, { FunctionComponent, useEffect, useState } from 'react'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'reactflow'

import { useGraph } from 'contexts/graph'
import styles from 'styles/FunctionNode.module.css'

export const FUNCTION_NODE_INIT_HEIGHT = 128
export const FUNCTION_NODE_INIT_WIDTH = 128
export type FunctionNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  functionTypeId: string
  color: string
  // below set after load from pg
  setNodeDataToChange: (data: FunctionNodeProperties) => void
}
type FunctionNodeProps = {
  data: FunctionNodeProperties
  selected: boolean
}
const FunctionNode: FunctionComponent<FunctionNodeProps> = ({
  data,
  selected,
}) => {
  const { formNodeHandleStyle, getFunctionSymbol } = useGraph()

  const [symbol, setSymbol] = useState('')
  useEffect(() => {
    if (!getFunctionSymbol) return
    setSymbol(getFunctionSymbol(data.functionTypeId))
  }, [getFunctionSymbol, setSymbol, data.functionTypeId])

  return (
    <div
      className={styles.function_node}
      style={{
        height: `${FUNCTION_NODE_INIT_HEIGHT}px`,
        width: `${FUNCTION_NODE_INIT_WIDTH}px`,
        backgroundColor: '#ffffff',
        border: selected ? '5px solid' : '1px solid',
      }}
    >
      <div className={styles.symbol}>{symbol}</div>
      <Handle
        type="source"
        id="top_source"
        position={Position.Top}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'source', Position.Top)}
      />
      <Handle
        type="source"
        id="right_source"
        position={Position.Right}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'source', Position.Right)}
      />
      <Handle
        type="source"
        id="bottom_source"
        position={Position.Bottom}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'source', Position.Bottom)}
      />
      <Handle
        type="source"
        id="left_source"
        position={Position.Left}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'source', Position.Left)}
      />
      <Handle
        type="target"
        id="top_target"
        position={Position.Top}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'target', Position.Top)}
      />
      <Handle
        type="target"
        id="right_target"
        position={Position.Right}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'target', Position.Right)}
      />
      <Handle
        type="target"
        id="bottom_target"
        position={Position.Bottom}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'target', Position.Bottom)}
      />
      <Handle
        type="target"
        id="left_target"
        position={Position.Left}
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        style={formNodeHandleStyle!(data.id, 'target', Position.Left)}
      />
    </div>
  )
}

export default FunctionNode
