import { NodeResizer } from '@reactflow/node-resizer'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult } from 'react-color'
import { EditText, onSaveProps } from 'react-edit-text'
import 'react-edit-text/dist/index.css'
import { Handle, Node, Position } from 'reactflow'

import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/CustomNode.module.css'
import CustomNodeRenderer from './CustomNodeRenderer'
import ColorPicker from './nodepanel/ColorPicker'
import NodePanel from './nodepanel/NodePanel'

export type CustomNodeSource = {
  html: string
  css: string
}
export type CustomNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  name: string
  description: string
  owner: string
  source: CustomNodeSource
  color: string
  // below not in postgres
  initialProperties: object
  setNodeDataToChange: (data: CustomNodeProperties) => void
}
type CustomNodeProps = {
  data: CustomNodeProperties
  selected: boolean
  xPos: number
  yPos: number
}
const CustomNode: FunctionComponent<CustomNodeProps> = ({
  data,
  selected,
  xPos,
  yPos,
}) => {
  const { editingEnabled } = useEditability()
  const { graph, nodeShouldRender, updateGraph, formNodeHandleStyle } =
    useGraph()

  const INIT_HEIGHT = 288
  const INIT_WIDTH = 512

  const [thisNode, setThisNode] = useState<Node | undefined>(undefined)
  useEffect(() => {
    setThisNode(graph.nodes.find((node) => node.id === data.id))
  }, [graph.nodes, data.id])

  const [name, setName] = useState('')
  useEffect(() => {
    setName(data.name)
  }, [data.name])
  const saveName = useCallback(
    ({ value }: onSaveProps) => {
      const newData = { ...data }
      newData.name = value
      data.setNodeDataToChange(newData)
    },
    [data]
  )

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
  const handleColorChangeComplete = useCallback(
    (color: ColorResult) => {
      setColor(color.hex)
      saveColor(color)
    },
    [setColor, saveColor]
  )

  const [shouldRender, setShouldRender] = useState(true)
  useEffect(() => {
    if (thisNode && nodeShouldRender) {
      setShouldRender(nodeShouldRender(thisNode, xPos, yPos))
    } else {
      setShouldRender(false)
    }
  }, [thisNode, xPos, yPos, nodeShouldRender])

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
      className={styles.custom_node}
      style={{
        height: `${thisNode?.height || INIT_HEIGHT}px`,
        width: `${thisNode?.width || INIT_WIDTH}px`,
        backgroundColor: '#ffffff',
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div className={styles.header}>
        <EditText
          value={name}
          readonly={!editingEnabled}
          style={{
            backgroundColor: editingEnabled ? '#eee' : 'transparent',
            fontSize: '2em',
            fontWeight: 'bold',
            // remove spacing
            margin: 0,
            padding: 0,
          }}
          onChange={(e) => setName(e.target.value)}
          onSave={saveName}
        />
        <NodePanel
          nodeId={data.id}
          additions={
            <ColorPicker
              color={color}
              onChangeComplete={handleColorChangeComplete}
            />
          }
        />
      </div>
      <div className={styles.body}>
        <CustomNodeRenderer
          parentCustomNodeId={data.id}
          shouldRender={shouldRender}
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

export default CustomNode
