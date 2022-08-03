import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult } from 'react-color'
import { EditText, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import NodeMenu from './NodeMenu'
import { useEditability } from '../../contexts/editability'
import styles from '../../styles/MetricNode.module.css'

export type MetricNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  name: string
  color: string
  // below not in postgres
  initialProperties: object
  setNodeDatatoChange: (data: MetricNodeProperties) => void
}
type MetricNodeProps = {
  data: MetricNodeProperties
  selected: boolean
}
const MetricNode: FunctionComponent<MetricNodeProps> = ({ data, selected }) => {
  const { editingEnabled } = useEditability()
  const nodeHandleSize = editingEnabled ? '10px' : '0px'

  const [name, setName] = useState('')
  useEffect(() => {
    setName(data.name)
  }, [data.name])
  const saveName = useCallback(
    ({ value }: onSaveProps) => {
      let newData = { ...data }
      newData.name = value
      data.setNodeDatatoChange(newData)
    },
    [data]
  )

  const [color, setColor] = useState('#FFFFFF')
  useEffect(() => {
    setColor(data.color)
  }, [data.color])
  const saveColor = useCallback(
    (color: ColorResult) => {
      let newData = { ...data }
      newData.color = color.hex
      data.setNodeDatatoChange(newData)
    },
    [data]
  )

  return (
    <div
      className={styles.metric_node}
      style={{
        backgroundColor: color,
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div className={styles.header}>
        <div className={styles.name}>
          <EditText
            value={name}
            readonly={!editingEnabled}
            style={
              editingEnabled
                ? { backgroundColor: '#eee' }
                : { backgroundColor: color }
            }
            onChange={(e) => setName(e.target.value)}
            onSave={saveName}
          />
        </div>
        <div className={styles.buttons}>
          <NodeMenu
            color={color}
            setColor={setColor}
            saveColor={saveColor}
          />
        </div>
      </div>
      <Handle
        type="source"
        id="top_source"
        position={Position.Top}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="right_source"
        position={Position.Right}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="bottom_source"
        position={Position.Bottom}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="left_source"
        position={Position.Left}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="top_target"
        position={Position.Top}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="right_target"
        position={Position.Right}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="bottom_target"
        position={Position.Bottom}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="left_target"
        position={Position.Left}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
    </div>
  )
}

export default MetricNode
