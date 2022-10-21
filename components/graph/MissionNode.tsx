import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult } from 'react-color'
import { EditTextarea, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'
import useFitText from 'use-fit-text'

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/MissionNode.module.css'
import NodeMenu from './NodeMenu'

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
  const nodeHandleSize = '0px'

  const { editingEnabled } = useEditability()

  const [mission, setMission] = useState('')
  useEffect(() => {
    const _mission = data.mission
    setMission(_mission)
  }, [data.mission])
  const saveMission = useCallback(
    ({ value }: onSaveProps) => {
      setResizeInProgress(true)
      let newData = { ...data }
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

  const [color, setColor] = useState('#FFFFFF')
  useEffect(() => {
    setColor(data.color)
  }, [data.color])
  const saveColor = useCallback(
    (color: ColorResult) => {
      let newData = { ...data }
      newData.color = color.hex
      data.setNodeDataToChange(newData)
    },
    [data]
  )

  return (
    <div
      className={styles.mission_node}
      style={{
        backgroundColor: color,
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div className={styles.header}>
        <div className={styles.buttons}>
          <NodeMenu color={color} setColor={setColor} saveColor={saveColor} />
        </div>
      </div>
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

export default MissionNode
