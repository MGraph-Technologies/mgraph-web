import { Button } from 'primereact/button'
import React, { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { EditText, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import { useEditability } from '../contexts/editability'
import styles from '../styles/MetricNode.module.css'

export type MetricNodeDataType = {
  nodeId: string;
  name: string;
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
  
  return (
    <div className={styles.metric_node}>
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
          <Button
            className='p-button-text'
            icon="pi pi-angle-right"
            onClick={() => {}} // TODO: activate
          />
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