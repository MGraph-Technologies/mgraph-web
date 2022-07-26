import { Button } from 'primereact/button'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult, TwitterPicker } from 'react-color'
import { EditText, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import { useEditability } from '../contexts/editability'
import styles from '../styles/MetricNode.module.css'

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
  const [displayColorPicker, setDisplayColorPicker] = useState(false)

  const handleColorChangeComplete = useCallback(
    (color: ColorResult) => {
      setColor(color.hex)
      saveColor(color)
      setDisplayColorPicker(false)
    },
    [saveColor]
  )

  return (
    <div
      className={styles.metric_node}
      style={{
        backgroundColor: color,
        border: selected ? '1px solid' : '0px',
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
          {!editingEnabled ? (
            <Button
              className="p-button-text"
              icon="pi pi-angle-right"
              onClick={() => {}} // TODO: activate
            />
          ) : null}
          {editingEnabled && !displayColorPicker ? (
            <>
              <Button
                className="p-button-text"
                icon="pi pi-ellipsis-v"
                onClick={() => setDisplayColorPicker(true)}
              />
            </>
          ) : null}
          {editingEnabled && displayColorPicker ? (
            <>
              <TwitterPicker
                color={color}
                onChangeComplete={(color) => handleColorChangeComplete(color)}
              />
              <Button
                className="p-button-text"
                icon="pi pi-times"
                onClick={() => setDisplayColorPicker(false)}
              />
            </>
          ) : null}
        </div>
      </div>
      <Handle
        type="source"
        id="top"
        position={Position.Top}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="bottom"
        position={Position.Bottom}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="left"
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
