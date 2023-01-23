import { NodeResizer } from '@reactflow/node-resizer'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { EditTextarea, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Node, Position } from 'reactflow'
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
  const { graph, updateGraph, formNodeHandleStyle } = useGraph()

  const INIT_HEIGHT = 144
  const INIT_WIDTH = 1024

  const [thisNode, setThisNode] = useState<Node | undefined>(undefined)
  useEffect(() => {
    setThisNode(graph.nodes.find((node) => node.id === data.id))
  }, [graph.nodes, data.id])

  const [mission, setMission] = useState('')
  useEffect(() => {
    const _mission = data.mission
    setMission(_mission)
  }, [data.mission])
  const saveMission = useCallback(
    ({ value }: onSaveProps) => {
      setFontResizeInProgress(true)
      const newData = { ...data }
      newData.mission = value
      data.setNodeDataToChange(newData)
    },
    [data]
  )

  const [fontResizeInProgess, setFontResizeInProgress] = useState(true)
  const { fontSize, ref } = useFitText({
    maxFontSize: 10000,
    minFontSize: 0,
    onStart: () => {
      setFontResizeInProgress(true)
    },
    onFinish: () => {
      setFontResizeInProgress(false)
    },
  })

  const onNodeResizeStart = useCallback(() => {
    // create update to undo to
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    updateGraph!(
      {
        nodes: undefined,
        edges: undefined,
      },
      true
    )
  }, [updateGraph])

  return (
    <div
      className={styles.mission_node}
      style={{
        height: `${thisNode?.height || INIT_HEIGHT}px`,
        width: `${thisNode?.width || INIT_WIDTH}px`,
        backgroundColor: '#ffffff',
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div
        className={styles.mission_container}
        ref={ref}
        style={{ fontSize: editingEnabled ? 48 : fontSize }}
      >
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
            visibility: fontResizeInProgess ? 'hidden' : 'visible',
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
      <NodeResizer
        isVisible={editingEnabled}
        handleStyle={{
          width: '10px',
          height: '10px',
        }}
        minHeight={INIT_HEIGHT}
        minWidth={INIT_WIDTH}
        onResizeStart={onNodeResizeStart}
      />
    </div>
  )
}

export default MissionNode
