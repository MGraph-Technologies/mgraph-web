import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult } from 'react-color'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import { useGraph } from '../../contexts/graph'
import styles from '../../styles/FunctionNode.module.css'
import NodeMenu from './NodeMenu'

export type FunctionNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  functionTypeId: string
  color: string
  // below not in postgres
  initialProperties: object
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

  const [color, setColor] = useState('#FFFFFF')
  useEffect(() => {
    setColor(data.color)
  }, [data.color])
  const saveColor = useCallback(
    (color: ColorResult) => {
      const newData = { ...data }
      newData.color = color.hex
      data.setNodeDataToChange(newData)
    },
    [data]
  )

  return (
    <div
      className={styles.function_node}
      style={{
        backgroundColor: color,
        border: selected ? '5px solid' : '1px solid',
      }}
    >
      <div className={styles.header}>
        <div className={styles.buttons}>
          <NodeMenu color={color} setColor={setColor} saveColor={saveColor} />
        </div>
      </div>
      <div className={styles.symbol}>
        <h1>{symbol}</h1>
      </div>
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
