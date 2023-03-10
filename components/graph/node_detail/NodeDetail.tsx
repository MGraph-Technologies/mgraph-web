import Head from 'next/head'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Toolbar } from 'primereact/toolbar'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Edge, Node } from 'reactflow'
import 'react-edit-text/dist/index.css'

import MentionField from 'components/MentionField'
import SectionHeader from 'components/SectionHeader'
import ControlPanel from 'components/graph/ControlPanel'
import {
  CustomNodeProperties,
  CustomNodeSource,
} from 'components/graph/CustomNode'
import CustomNodeRenderer from 'components/graph/CustomNodeRenderer'
import LineChart from 'components/graph/LineChart'
import {
  MetricNodeProperties,
  MetricNodeSource,
} from 'components/graph/MetricNode'
import PresencePanel from 'components/graph/PresencePanel'
import QueryRunner, { QueryResult } from 'components/graph/QueryRunner'
import UndoRedoAndDoneGraphEditingButtons from 'components/graph/editing/UndoRedoAndDoneGraphEditingButtons'
import GoalsTable from 'components/graph/node_detail/GoalsTable'
import MonitoringRulesTable from 'components/graph/node_detail/MonitoringRulesTable'
import CustomNodeSourceFields from 'components/graph/node_detail/CustomNodeSourceFields'
import MetricNodeSourceFields from 'components/graph/node_detail/MetricNodeSourceFields'
import NodePanel from 'components/graph/nodepanel/NodePanel'
import { useAuth } from 'contexts/auth'
import { useBrowser } from 'contexts/browser'
import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import styles from 'styles/NodeDetail.module.css'
import { getConnectedObjects } from 'utils/getConnectedObjects'

type NodeDetailProps = {
  nodeId: string
}
const NodeDetail: FunctionComponent<NodeDetailProps> = ({ nodeId }) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()
  const { editingEnabled } = useEditability()
  const { graph, getFunctionSymbol } = useGraph()

  const [node, setNode] = useState<Node | undefined>(undefined)
  const [nodeTypeTitleCase, setNodeTypeTitleCase] = useState<
    string | undefined
  >(undefined)
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState('')
  const [outputs, setOutputs] = useState('')

  const [queryRunnerRefreshes, setQueryRunnerRefreshes] = useState(0)
  const [queryResult, setQueryResult] = useState<QueryResult>({
    status: 'processing',
    data: null,
  })

  const populateNode = useCallback(() => {
    if (nodeId && graph.nodes.length > 0) {
      const _node = graph.nodes.find((node) => node.id === nodeId)
      if (_node) {
        setNode(_node)
      } else {
        push('/')
      }
    }
  }, [graph, nodeId, push])
  useEffect(() => {
    populateNode()
  }, [populateNode, editingEnabled])

  const populateDetails = useCallback(() => {
    setNodeTypeTitleCase(
      node?.type
        ? node.type.charAt(0).toUpperCase() + node.type.slice(1)
        : undefined
    )
    setName(node?.data.name || '')
    setOwner(node?.data.owner || '')
    setDescription(node?.data.description || '')
  }, [node])
  useEffect(() => {
    populateDetails()
  }, [populateDetails])

  const FUNCTION_TYPE_ID_MARKER_PREFIX = 'functionTypeId:'
  const populateInputsAndOutputs = useCallback(() => {
    let newInputs = ''
    let newOutputs = ''
    if (node && getConnectedObjects) {
      const nodeConnectedObjects = getConnectedObjects(graph, node, 1)
      const nodeConnectedIdentities = nodeConnectedObjects.filter(
        (nodeConnectedObject) =>
          nodeConnectedObject.type === 'function' &&
          graph.edges.filter(
            (edge) => edge.data.targetId === nodeConnectedObject.id
          ).length === 1
      )
      nodeConnectedIdentities.forEach((nodeConnectedIdentity) => {
        const formulaObjects = [nodeConnectedIdentity].concat(
          getConnectedObjects(graph, nodeConnectedIdentity, 1)
        )
        let formulaObjectsSorted: (Node | Edge)[] = []
        // add output
        const output = formulaObjects.find(
          (formulaObject) =>
            (formulaObject.type === 'custom' ||
              formulaObject.type === 'metric') &&
            graph.edges.find(
              (edge) =>
                edge.data.targetId === formulaObject.id &&
                edge.data.sourceId === nodeConnectedIdentity.id
            )
        )
        if (output) {
          formulaObjectsSorted.push(output)
        }
        // add subsequent objects
        while (
          formulaObjectsSorted.length > 0 &&
          formulaObjectsSorted.length < formulaObjects.length
        ) {
          const lastObject =
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            formulaObjectsSorted[formulaObjectsSorted.length - 1]!
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (['custom', 'function', 'metric'].includes(lastObject.type!)) {
            const nextObject = formulaObjects.find(
              (formulaObject) =>
                formulaObject.type === 'input' &&
                'target' in formulaObject &&
                formulaObject.target === lastObject.id
            )
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            formulaObjectsSorted.push(nextObject!)
          } else {
            // lastObject.type === 'input'
            const nextObject = formulaObjects.find(
              (formulaObject) =>
                'source' in lastObject && formulaObject.id === lastObject.source
            )
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            formulaObjectsSorted.push(nextObject!)
          }
        }
        // remove edges and sort to match order in which entered
        formulaObjectsSorted = formulaObjectsSorted.filter(
          (formulaObject) => formulaObject.type !== 'input'
        )
        formulaObjectsSorted = formulaObjectsSorted
          .slice(0, 2)
          .concat(formulaObjectsSorted.slice(2).reverse())
        // concatenate formula to input or output as appropriate
        const expand = (inputsOrOutputs: string) => {
          return inputsOrOutputs.concat(
            inputsOrOutputs.length > 0 ? '\n\n' : '',
            formulaObjectsSorted
              .map((formulaObject) => {
                if (['custom', 'metric'].includes(formulaObject.type || '')) {
                  return formulaObject.data.name
                } else if (formulaObject.type === 'function') {
                  // subsequently replaced by replaceFunctionTypeIdWithSymbol
                  return (
                    FUNCTION_TYPE_ID_MARKER_PREFIX +
                    formulaObject.data.functionTypeId
                  )
                }
              })
              .join(' ')
          )
        }
        if (formulaObjectsSorted[0].id === nodeId) {
          newInputs = expand(newInputs)
        } else {
          newOutputs = expand(newOutputs)
        }
      })
    }
    setInputs(newInputs)
    setOutputs(newOutputs)
  }, [node, graph, nodeId])
  useEffect(() => {
    populateInputsAndOutputs()
  }, [populateInputsAndOutputs])

  const functionTypeIdRegex = RegExp(
    FUNCTION_TYPE_ID_MARKER_PREFIX + '([\\w-]+)'
  )
  const replaceFunctionTypeIdWithSymbol = useCallback(
    async (str: string) => {
      const matches = str.match(functionTypeIdRegex)
      if (matches && getFunctionSymbol) {
        const symbol = getFunctionSymbol(matches[1])
        return str.replace(matches[0], symbol)
      } else {
        return str
      }
    },
    [functionTypeIdRegex, getFunctionSymbol]
  )
  useEffect(() => {
    const populateInputs = async () => {
      const _inputs = await replaceFunctionTypeIdWithSymbol(inputs)
      if (_inputs !== inputs) {
        setInputs(_inputs)
      }
    }
    populateInputs()
  }, [inputs, replaceFunctionTypeIdWithSymbol])
  useEffect(() => {
    const populateOutputs = async () => {
      const _outputs = await replaceFunctionTypeIdWithSymbol(outputs)
      if (_outputs !== outputs) {
        setOutputs(_outputs)
      }
    }
    populateOutputs()
  }, [outputs, replaceFunctionTypeIdWithSymbol])

  const saveDetail = useCallback(
    (
      name: keyof CustomNodeProperties | keyof MetricNodeProperties,
      value: string | CustomNodeSource | MetricNodeSource
    ) => {
      if (node) {
        const newData = {
          ...node.data,
          [name]: value,
        }
        node.data.setNodeDataToChange(newData)
      }
    },
    [node]
  )

  // scroll to hash upon page load
  useEffect(() => {
    const hash = window?.location?.hash
    if (hash) {
      document.getElementById(hash.replace('#', ''))?.scrollIntoView()
    }
  }, [])

  return (
    <div className={styles.node_detail}>
      <Head>
        <title>
          {nodeTypeTitleCase && name ? `${nodeTypeTitleCase}: ${name}` : 'Node'}{' '}
          — MGraph
        </title>
      </Head>
      <div className={styles.header}>
        <Button
          id="back-to-graphviewer-button"
          className="p-button-text"
          icon="pi pi-angle-left"
          onClick={() => {
            push('/' + organizationName)
          }}
          style={{ minWidth: '32px' }}
        />
        {editingEnabled ? (
          <InputText
            id="name-field"
            className={styles.detail_field_editable}
            value={name}
            style={{
              fontSize: '2em',
              fontWeight: 'bold',
              width: '600px',
            }}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              saveDetail('name', name)
            }}
          />
        ) : (
          <SectionHeader title={name} size="h1" includeMargin={false} />
        )}
        <NodePanel nodeId={nodeId} />
        <PresencePanel pageId={nodeId} />
        <ControlPanel />
      </div>
      <div className={styles.body}>
        {nodeTypeTitleCase === 'Custom' && (
          <div className={styles.html_container}>
            <CustomNodeRenderer
              parentCustomNodeId={nodeId}
              expandHeight={true}
            />
          </div>
        )}
        {nodeTypeTitleCase === 'Metric' && (
          <>
            <div className={styles.chart_container}>
              <>
                <QueryRunner
                  parentMetricNodeData={node?.data}
                  refreshes={queryRunnerRefreshes}
                  queryResult={queryResult}
                  setQueryResult={setQueryResult}
                />
                <LineChart
                  parentMetricNodeId={nodeId}
                  queryResult={queryResult}
                />
              </>
            </div>
            {editingEnabled && (
              <div className={styles.chart_settings_container}>
                <ChartSettingField
                  fieldName="yMin"
                  fieldType="number"
                  saveDetail={saveDetail}
                  node={node}
                />
                <ChartSettingField
                  fieldName="yMax"
                  fieldType="number"
                  saveDetail={saveDetail}
                  node={node}
                />
                <Button
                  id="refresh-query-button"
                  className="p-button-text"
                  icon="pi pi-refresh"
                  onClick={() => {
                    setQueryRunnerRefreshes(queryRunnerRefreshes + 1)
                  }}
                />
              </div>
            )}
          </>
        )}
        <SectionHeader title="Owner" size="h2" />
        <MentionField
          id="owner-field"
          className={styles.detail_field_editable}
          editable={editingEnabled}
          value={owner}
          setValue={setOwner}
          placeholder={editingEnabled ? 'Add...' : '-'}
          onBlur={() => saveDetail('owner', owner)}
        />
        <SectionHeader title="Description" size="h2" />
        <MentionField
          id="description-field"
          className={styles.detail_field_editable}
          editable={editingEnabled}
          value={description}
          setValue={setDescription}
          placeholder={editingEnabled ? 'Add...' : '-'}
          onBlur={() => saveDetail('description', description)}
        />
        <SectionHeader title="Inputs" size="h2" />
        <pre className={styles.detail_field}>
          {inputs.match(functionTypeIdRegex) ? '' : inputs.trim()}
        </pre>
        <SectionHeader title="Outputs" size="h2" />
        <pre className={styles.detail_field}>
          {outputs.match(functionTypeIdRegex) ? '' : outputs.trim()}
        </pre>
        {nodeTypeTitleCase === 'Custom' && (
          <>
            <SectionHeader title="Source" size="h2" />
            <CustomNodeSourceFields customNode={node} saveDetail={saveDetail} />
          </>
        )}
        {nodeTypeTitleCase === 'Metric' && (
          <>
            <SectionHeader title="Goals" size="h2" />
            <GoalsTable parentNodeId={nodeId} />
            <SectionHeader title="Monitoring Rules" size="h2" />
            <MonitoringRulesTable parentNodeId={nodeId} />
            <SectionHeader title="Source" size="h2" />
            <MetricNodeSourceFields metricNode={node} saveDetail={saveDetail} />
          </>
        )}
      </div>
      {editingEnabled && (
        <div className={styles.editor_dock}>
          <Toolbar right={<UndoRedoAndDoneGraphEditingButtons />} />
        </div>
      )}
    </div>
  )
}

type ChartSettingFieldProps = {
  fieldName: string
  fieldType: 'number' | 'string'
  saveDetail: (
    name: keyof CustomNodeProperties | keyof MetricNodeProperties,
    value: string | CustomNodeSource | MetricNodeSource
  ) => void
  node: Node | undefined
}
const ChartSettingField: FunctionComponent<ChartSettingFieldProps> = ({
  fieldName,
  fieldType,
  saveDetail,
  node,
}) => {
  const [valueStr, setValueStr] = useState<string>(
    node?.data.chartSettings?.[fieldName]?.toString() || ''
  )
  return (
    <div id={`chart-${fieldName}-field-container`}>
      <label htmlFor={`chart-${fieldName}-field`}>{fieldName}: </label>
      <InputText
        id={`chart-${fieldName}-field`}
        value={valueStr}
        style={{
          width: '100px',
        }}
        onChange={(e) => {
          if (fieldType === 'number' && isNaN(Number(e.target.value))) {
            alert(`${fieldName} must be a number.`)
            return
          }
          setValueStr(e.target.value)
        }}
        onBlur={() => {
          const newVal =
            valueStr === ''
              ? undefined
              : fieldType === 'number'
              ? Number(valueStr)
              : valueStr
          const newChartSettings = {
            ...node?.data.chartSettings,
            [fieldName]: newVal,
          }
          saveDetail('chartSettings', newChartSettings)
        }}
      />
      {valueStr !== '' && (
        <Button
          id={`chart-${fieldName}-field-clear-button`}
          className="p-button-text"
          icon="pi pi-times"
          onClick={() => {
            setValueStr('')
            const newChartSettings = {
              ...node?.data.chartSettings,
              [fieldName]: undefined,
            }
            saveDetail('chartSettings', newChartSettings)
          }}
        />
      )}
    </div>
  )
}

export default NodeDetail
