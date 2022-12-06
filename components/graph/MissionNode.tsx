import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { EditTextarea, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'
import useFitText from 'use-fit-text'

import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/MissionNode.module.css'

export type MissionNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  color: string
  mission: string
  // below not in postgres
  initialProperties: object
  setNodeDataToChange: (data: MissionNodeProperties) => void
}
type MissionNodeProps = {
  data: MissionNodeProperties
  selected: boolean
}
const MissionNode: FunctionComponent<MissionNodeProps> = ({
  data,
  selected,
}) => {
  const { editingEnabled } = useEditability()
  const { formNodeHandleStyle } = useGraph()

  const [mission, setMission] = useState('')
  useEffect(() => {
    const _mission = data.mission
    setMission(_mission)
  }, [data.mission])
  const saveMission = useCallback(
    ({ value }: onSaveProps) => {
      setResizeInProgress(true)
      const newData = { ...data }
      newData.mission = value
      data.setNodeDataToChange(newData)
    },
    [data]
  )

  const [resizeInProgess, setResizeInProgress] = useState(true)
  const { fontSize, ref } = useFitText({
    maxFontSize: 10000,
    minFontSize: 0,
    onStart: () => {
      setResizeInProgress(true)
    },
    onFinish: () => {
      setResizeInProgress(false)
    },
  })

  return (
    <div
      className={styles.mission_node}
      style={{
        backgroundColor: '#ffffff',
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div className={styles.mission_container} ref={ref} style={{ fontSize }}>
        <EditTextarea
          id="mission-field"
          value={mission}
          placeholder="Our mission is..."
          readonly={!editingEnabled}
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'visible',
            overflowWrap: 'break-word',
            textAlign: 'center',
            fontWeight: 'bold',
            backgroundColor: editingEnabled ? '#f8f8f8' : '#ffffff',
            visibility: resizeInProgess ? 'hidden' : 'visible',
          }}
          onChange={(e) => setMission(e.target.value)}
          onSave={saveMission}
        />
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

export default MissionNode
