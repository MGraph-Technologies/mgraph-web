import router from 'next/router'
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

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/MetricNode.module.css'
import LineChart from '../LineChart'
import QueryRunner, { QueryResult } from '../QueryRunner'
import NodeMenu from './NodeMenu'

export type MetricNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  name: string
  description: string
  owner: string
  sourceCode: string
  sourceDatabaseConnectionId: string
  color: string
  // below not in postgres
  initialProperties: object
  setNodeDataToChange: (data: MetricNodeProperties) => void
}
type MetricNodeProps = {
  data: MetricNodeProperties
  selected: boolean
}
const MetricNode: FunctionComponent<MetricNodeProps> = ({ data, selected }) => {
  const { organizationName } = router.query
  const { editingEnabled } = useEditability()
  const nodeHandleSize = '0px'

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
    status:
      !data.sourceCode || !data.sourceDatabaseConnectionId
        ? 'empty'
        : 'processing',
    data: null,
  })

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
          <h1>
            <EditText
              value={name}
              readonly={!editingEnabled}
              style={
                editingEnabled
                  ? { backgroundColor: '#eee' }
                  : { backgroundColor: color }
              }
              onChange={(e) => setName(e.target.value)}
              onSave={saveName}
            />
          </h1>
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
          statement={data.sourceCode}
          databaseConnectionId={data.sourceDatabaseConnectionId}
          parentNodeId={data.id}
          refreshes={0}
          setQueryResult={setQueryResult}
        />
        <LineChart queryResult={queryResult} />
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

export default MetricNode
