import { Button } from 'primereact/button'
import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { ColorResult, TwitterPicker } from 'react-color'
import { EditText, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import { useEditability } from '../contexts/editability'
import styles from '../styles/MetricNode.module.css'

export type MetricNodeDataType = {
  nodeId: string;
  name: string;
  color: string;
  setNodeDatatoChange: (data: MetricNodeDataType) => void;
}
type MetricNodeProps = {
  data: MetricNodeDataType
}
const MetricNode: FunctionComponent<MetricNodeProps> = ({ data }) => {
  const { editingEnabled } = useEditability()
  
  const [name, setName] = useState('')
  useEffect(() => {
    setName(data.name)
  }, [data.name])
  const saveName = useCallback(({ value } : onSaveProps) => {
    let newData = { ...data }
    newData.name = value
    data.setNodeDatatoChange(newData)
  }, [data])
  
  const [color, setColor] = useState('#FFFFFF')
  useEffect(() => {
    setColor(data.color)
  }, [data.color])
  const saveColor = useCallback((color: ColorResult) => {
    let newData = { ...data }
    newData.color = color.hex
    data.setNodeDatatoChange(newData)
  }, [data])
  const [displayColorPicker, setDisplayColorPicker] = useState(false)

  const handleColorChangeComplete = useCallback((color: ColorResult) => {
    setColor(color.hex)
    saveColor(color)
    setDisplayColorPicker(false)
  }, [saveColor])
  
  return (
    <div className={styles.metric_node} style={{ backgroundColor: color }}>
      <div className={styles.header}>
        <div className={styles.name}>
          <EditText
            value={name}
            readonly={!editingEnabled}
            style={ editingEnabled ? {backgroundColor: '#eee'} : { backgroundColor: 'white' }}
            onChange={(e) => setName(e.target.value)}
            onSave={saveName}
          />
        </div>
        <div className={styles.buttons}>
        {!editingEnabled
          ? <Button
              className='p-button-text'
              icon='pi pi-angle-right'
              onClick={() => {}} // TODO: activate
            />
          : null}
        {editingEnabled && !displayColorPicker
          ? <>
              <Button
                className='p-button-text'
                icon='pi pi-ellipsis-v'
                onClick={() => setDisplayColorPicker(true)}
                />
            </>
          : null}
        {editingEnabled && displayColorPicker
          ? <>
              <TwitterPicker 
                color={color}
                onChangeComplete={(color) => handleColorChangeComplete(color)}
              />
              <Button
                className='p-button-text'
                icon='pi pi-times'
                onClick={() => setDisplayColorPicker(false)}
              />
            </>
          : null}
        </div>
      </div>
      <Handle type="source" position={Position.Top} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

export default MetricNode