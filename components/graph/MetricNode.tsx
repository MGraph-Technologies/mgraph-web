import router from 'next/router'
import { Button } from 'primereact/button'
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
import { useAuth } from '../../contexts/auth'

import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/MetricNode.module.css'
import LineChart from '../LineChart'
import QueryRunner, { QueryResult } from '../QueryRunner'
import NodeInfoButton from './NodeInfoButton'
import NodeMenu from './NodeMenu'

export type SourceCodeLanguage = 'sql' | 'yaml'
export type MetricNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  name: string
  description: string
  owner: string
  sourceCode: string
  sourceCodeLanguage: SourceCodeLanguage
  sourceDatabaseConnectionId: string
  sourceSyncId: string | null
  sourceSyncPath: string | null
  color: string
  // below not in postgres
  initialProperties: object
  setNodeDataToChange: (data: MetricNodeProperties) => void
}
type MetricNodeProps = {
  data: MetricNodeProperties
  selected: boolean
  xPos: number
  yPos: number
}
const MetricNode: FunctionComponent<MetricNodeProps> = ({
  data,
  selected,
  xPos,
  yPos,
}) => {
  const { organizationName } = router.query
  const { userOnMobile } = useAuth()
  const { editingEnabled } = useEditability()
  const { graph, reactFlowRenderer, reactFlowViewport, formNodeHandleStyle } =
    useGraph()

  const [name, setName] = useState('')
  useEffect(() => {
    setName(data.name)
  }, [data.name])
  const saveName = useCallback(
    ({ value }: onSaveProps) => {
      let newData = { ...data }
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
      let newData = { ...data }
      newData.color = color.hex
      data.setNodeDataToChange(newData)
    },
    [data]
  )

  const [queryResult, setQueryResult] = useState<QueryResult>({
    status: 'processing',
    data: null,
  })

  const [renderChart, setRenderChart] = useState(false)
  useEffect(() => {
    const thisNode = graph.nodes.find((node) => node.id === data.id)
    if (!reactFlowViewport || !reactFlowRenderer || !thisNode) return
    const scale = 1 / reactFlowViewport.zoom
    const clientWidth = reactFlowRenderer.clientWidth
    const clientHeight = reactFlowRenderer.clientHeight
    const clientWidthScaled = clientWidth * scale
    const clientHeightScaled = clientHeight * scale
    const rendererXLower = -reactFlowViewport.x * scale
    const rendererXUpper = rendererXLower + clientWidthScaled
    const rendererYLower = -reactFlowViewport.y * scale
    const rendererYUpper = rendererYLower + clientHeightScaled
    const nodeXLower = xPos
    const nodeXUpper = xPos + thisNode.width!
    const nodeYLower = yPos
    const nodeYUpper = yPos + thisNode.height!
    const xBuffer = userOnMobile ? 0 : clientWidth
    const yBuffer = userOnMobile ? 0 : clientHeight
    const minZoom = userOnMobile ? 0.2 : 0.1
    setRenderChart(
      nodeXLower < rendererXUpper + xBuffer &&
        nodeXUpper > rendererXLower - xBuffer &&
        nodeYLower < rendererYUpper + yBuffer &&
        nodeYUpper > rendererYLower - yBuffer &&
        reactFlowViewport.zoom > minZoom
    )
  }, [
    graph,
    data.id,
    reactFlowViewport,
    reactFlowRenderer,
    xPos,
    yPos,
    userOnMobile,
  ])

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
            style={{
              backgroundColor: editingEnabled ? '#eee' : 'transparent',
              fontSize: '2em',
              fontWeight: 'bold',
            }}
            onChange={(e) => setName(e.target.value)}
            onSave={saveName}
          />
          {!editingEnabled && <NodeInfoButton nodeData={data} />}
        </div>
        <div className={styles.buttons}>
          <NodeMenu
            color={color}
            setColor={setColor}
            saveColor={saveColor}
            linkTo={'/' + organizationName + '/metrics/' + data.id}
          />
        </div>
      </div>
      <div className={styles.chart_container}>
        <QueryRunner
          parentMetricNodeData={data}
          refreshes={0}
          queryResult={queryResult}
          setQueryResult={setQueryResult}
        />
        <LineChart queryResult={queryResult} renderChart={renderChart} />
      </div>
      <Handle
        type="source"
        id="top_source"
        position={Position.Top}
        style={formNodeHandleStyle!(data.id, 'source', Position.Top)}
      />
      <Handle
        type="source"
        id="right_source"
        position={Position.Right}
        style={formNodeHandleStyle!(data.id, 'source', Position.Right)}
      />
      <Handle
        type="source"
        id="bottom_source"
        position={Position.Bottom}
        style={formNodeHandleStyle!(data.id, 'source', Position.Bottom)}
      />
      <Handle
        type="source"
        id="left_source"
        position={Position.Left}
        style={formNodeHandleStyle!(data.id, 'source', Position.Left)}
      />
      <Handle
        type="target"
        id="top_target"
        position={Position.Top}
        style={formNodeHandleStyle!(data.id, 'target', Position.Top)}
      />
      <Handle
        type="target"
        id="right_target"
        position={Position.Right}
        style={formNodeHandleStyle!(data.id, 'target', Position.Right)}
      />
      <Handle
        type="target"
        id="bottom_target"
        position={Position.Bottom}
        style={formNodeHandleStyle!(data.id, 'target', Position.Bottom)}
      />
      <Handle
        type="target"
        id="left_target"
        position={Position.Left}
        style={formNodeHandleStyle!(data.id, 'target', Position.Left)}
      />
    </div>
  )
}

export default MetricNode
