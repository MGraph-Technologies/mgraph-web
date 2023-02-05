import Head from 'next/head'
import { Button } from 'primereact/button'
import { ConfirmDialog } from 'primereact/confirmdialog'
import { Toolbar } from 'primereact/toolbar'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { EditText } from 'react-edit-text'
import { Edge, Node } from 'reactflow'
import 'react-edit-text/dist/index.css'

import QueryRunner, { QueryResult } from '../../../components/graph/QueryRunner'
import SectionHeader from '../../../components/SectionHeader'
import { useAuth } from '../../../contexts/auth'
import { useBrowser } from '../../../contexts/browser'
import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'
import styles from '../../../styles/NodeDetail.module.css'
import MentionField from '../../MentionField'
import ControlPanel from '../ControlPanel'
import LineChart from '../LineChart'
import { CustomNodeProperties, CustomNodeSource } from '../CustomNode'
import CustomNodeRenderer from '../CustomNodeRenderer'
import { MetricNodeProperties, MetricNodeSource } from '../MetricNode'
import UndoRedoSaveAndCancelGraphEditingButtons from '../editing/UndoRedoSaveAndCancelGraphEditingButtons'
import NodePanel from '../nodepanel/NodePanel'
import GoalsTable from './GoalsTable'
import MonitoringRulesTable from './MonitoringRulesTable'
import CustomNodeSourceFields from './CustomNodeSourceFields'
import MetricNodeSourceFields from './MetricNodeSourceFields'

type NodeDetailProps = {
  nodeId: string
}
const NodeDetail: FunctionComponent<NodeDetailProps> = ({ nodeId }) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()
  const { editingEnabled } = useEditability()
  const { graph, getFunctionSymbol, getConnectedObjects } = useGraph()

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
      const nodeConnectedObjects = getConnectedObjects(node, 1)
      const nodeConnectedIdentities = nodeConnectedObjects.filter(
        (nodeConnectedObject) =>
          nodeConnectedObject.type === 'function' &&
          graph.edges.filter(
            (edge) => edge.data.targetId === nodeConnectedObject.id
          ).length === 1
      )
      nodeConnectedIdentities.forEach((nodeConnectedIdentity) => {
        const formulaObjects = [nodeConnectedIdentity].concat(
          getConnectedObjects(nodeConnectedIdentity, 1)
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
  }, [node, getConnectedObjects, graph.edges, nodeId])
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
        <EditText
          id="name-field"
          className={styles.detail_field_editable}
          value={name}
          readonly={!editingEnabled}
          formatDisplayText={(value) => {
            return editingEnabled
              ? value
              : `${nodeTypeTitleCase ? nodeTypeTitleCase : 'Node'}: ${value}`
          }}
          style={{
            fontSize: '2em',
            fontWeight: 'bold',
          }}
          onChange={(e) => setName(e.target.value)}
          onSave={({ value }) => saveDetail('name', value)}
        />
        <NodePanel nodeId={nodeId} />
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
              {editingEnabled && (
                <div className={styles.refresh_chart_button_container}>
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
          </div>
        )}
        <SectionHeader title="Owner" size="h2" />
        <MentionField
          id="owner-field"
          className={styles.detail_field_editable}
          value={owner}
          setValue={setOwner}
          placeholder={editingEnabled ? 'Add...' : '-'}
          onBlur={() => saveDetail('owner', owner)}
        />
        <SectionHeader title="Description" size="h2" />
        <MentionField
          id="description-field"
          className={styles.detail_field_editable}
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
            <GoalsTable parentNodeId={nodeId} includeConfirmDialogFC={false} />
            <SectionHeader title="Monitoring Rules" size="h2" />
            <MonitoringRulesTable
              parentNodeId={nodeId}
              includeConfirmDialogFC={false}
            />
            <SectionHeader title="Source" size="h2" />
            <MetricNodeSourceFields metricNode={node} saveDetail={saveDetail} />
          </>
        )}
      </div>
      {editingEnabled && (
        <div className={styles.editor_dock}>
          <Toolbar right={<UndoRedoSaveAndCancelGraphEditingButtons />} />
        </div>
      )}
      <ConfirmDialog />
    </div>
  )
}

export default NodeDetail
