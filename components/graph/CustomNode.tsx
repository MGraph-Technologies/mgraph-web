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

import CustomNodeRenderer from 'components/graph/CustomNodeRenderer'
import ColorPicker from 'components/graph/nodepanel/ColorPicker'
import NodePanel from 'components/graph/nodepanel/NodePanel'
import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import styles from 'styles/CustomNode.module.css'

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
  const { graph, nodeShouldRender, formNodeHandleStyle } = useGraph()

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

  const [rendererInteractionEnabled, setRendererInteractionEnabled] =
    useState(false)
  // reset on click outside of node
  useEffect(() => {
    const handleClickOutside = () => {
      setRendererInteractionEnabled(false)
    }
    window.addEventListener('click', handleClickOutside)
    return () => {
      window.removeEventListener('click', handleClickOutside)
    }
  }, [])

  const onResizeStart = useCallback(() => {
    // a somewhat-hacky way to save node state so that resize can be undone;
    // previous implementation (using updateGraph) was causing prior graph changes to be lost
    const newData = { ...data }
    data.setNodeDataToChange(newData)
  }, [data])

  return (
    <div
      className={styles.custom_node}
      style={{
        height: `${thisNode?.height || INIT_HEIGHT}px`,
        width: `${thisNode?.width || INIT_WIDTH}px`,
        backgroundColor: color,
        border: selected ? '5px solid' : '1px solid',
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
            minWidth: '100px',
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
        {/* prevent CustomNodeRenderer from receiving mouse events until overlay clicked */}
        <div
          className={styles.renderer_overlay}
          style={{
            pointerEvents: rendererInteractionEnabled ? 'none' : 'auto',
          }}
          onClick={(e) => {
            setRendererInteractionEnabled(true)
            e.stopPropagation() // preven node selection and subsequent detail push
          }}
        />
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
        onResizeStart={onResizeStart}
      />
    </div>
  )
}

export default CustomNode
