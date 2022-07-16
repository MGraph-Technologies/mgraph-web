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
  setUndoableLoggingEnabled: (enabled: boolean) => void;
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
      <EditText 
        value={name}
        readonly={!editingEnabled}
        onChange={(e) => setName(e.target.value)}
        // Clicking on a node also triggers onNodeDragStart, and thus disables logging
        // @ts-ignore https://github.com/bymi15/react-edit-text/issues/41
        onEditMode={(_e) => { data.setUndoableLoggingEnabled(true) }}
        onSave={saveName}
      />
      <Handle type="source" position={Position.Top} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

export default MetricNode