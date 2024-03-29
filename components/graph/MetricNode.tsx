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

import LineChart from 'components/graph/LineChart'
import QueryRunner, { QueryResult } from 'components/graph/QueryRunner'
import ColorPicker from 'components/graph/nodepanel/ColorPicker'
import NodePanel from 'components/graph/nodepanel/NodePanel'
import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import styles from 'styles/MetricNode.module.css'

export const METRIC_NODE_INIT_HEIGHT = 288
export const METRIC_NODE_INIT_WIDTH = 512
export type SourceQueryType = 'freeform' | 'generated'
export type MetricNodeSource = {
  databaseConnectionId: string
  query: string
  queryType: SourceQueryType
  dbtProjectGraphSyncId: string | null
  dbtProjectMetricPath: string | null
}
export type MetricNodeChartSettings = {
  yMin: number | undefined
  yMax: number | undefined
}
export type MetricNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  name: string
  description: string
  owner: string
  source: MetricNodeSource
  chartSettings: MetricNodeChartSettings | undefined
  color: string
  tablePosition: number | null
  // below set after load from pg
  setNodeDataToChange: (data: MetricNodeProperties) => void
  monitored: boolean
  alert: boolean | undefined
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
  const { editingEnabled } = useEditability()
  const { graph, goalStatusMap, nodeShouldRender, formNodeHandleStyle } =
    useGraph()

  const [thisNode, setThisNode] = useState<Node | undefined>(undefined)
  useEffect(() => {
    setThisNode(graph.nodes.find((node) => node.id === data.id))
  }, [graph.nodes, data.id])

  const [boxShadow, setBoxShadow] = useState('0px 0px 0px 0px #000000')
  useEffect(() => {
    const alert = data.alert
    const goalStatuses =
      goalStatusMap && goalStatusMap[data.id]
        ? Object.values(goalStatusMap[data.id])
        : []
    if (alert === true) {
      setBoxShadow('0px 0px 10px 5px #FF5757') // red if alert
    } else if (goalStatuses.includes('behind')) {
      setBoxShadow('0px 0px 10px 5px #F59E0B') // yellow if behind goal
    } else if (alert === false || goalStatuses.includes('ahead')) {
      setBoxShadow('0px 0px 10px 5px #3ECA6A') // green otherwise if monitoring or goal in effect
    }
  }, [data.alert, goalStatusMap, data.id])

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

  const [queryResult, setQueryResult] = useState<QueryResult>({
    status: 'processing',
    data: null,
  })

  const [renderChart, setRenderChart] = useState(false)
  useEffect(() => {
    if (thisNode && nodeShouldRender) {
      setRenderChart(nodeShouldRender(thisNode, xPos, yPos))
    } else {
      setRenderChart(false)
    }
  }, [thisNode, xPos, yPos, nodeShouldRender])

  const onResizeStart = useCallback(() => {
    // a somewhat-hacky way to save node state so that resize can be undone;
    // previous implementation (using updateGraph) was causing prior graph changes to be lost
    const newData = { ...data }
    data.setNodeDataToChange(newData)
  }, [data])

  return (
    <div
      className={styles.metric_node}
      style={{
        height: `${thisNode?.height || METRIC_NODE_INIT_HEIGHT}px`,
        width: `${thisNode?.width || METRIC_NODE_INIT_WIDTH}px`,
        backgroundColor: color,
        border: selected ? '5px solid' : '1px solid',
        boxShadow: boxShadow,
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
        <QueryRunner
          parentMetricNodeData={data}
          refreshes={0}
          queryResult={queryResult}
          setQueryResult={setQueryResult}
        />
        <LineChart
          parentMetricNodeId={data.id}
          queryResult={queryResult}
          renderChart={renderChart}
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
        minHeight={METRIC_NODE_INIT_HEIGHT}
        minWidth={METRIC_NODE_INIT_WIDTH}
        onResizeStart={onResizeStart}
      />
    </div>
  )
}

export default MetricNode
