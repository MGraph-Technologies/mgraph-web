import { useRouter } from 'next/router'
import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { EditText, EditTextarea, onSaveProps } from 'react-edit-text'
import { Edge, Node } from 'react-flow-renderer'
import 'react-edit-text/dist/index.css'

import ControlPanel from './ControlPanel'
import { getFunctionSymbol } from './FunctionNode'
import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/MetricDetail.module.css'
import UndoRedoSaveAndCancelGraphEditingButtons from './editing/UndoRedoSaveAndCancelGraphEditingButtons'

type MetricDetailProps = {
  metricId: string | string[] | undefined
}
const MetricDetail: FunctionComponent<MetricDetailProps> = ({ metricId }) => {
  const router = useRouter()
  const { organizationName } = router.query

  const { graph, getConnectedObjects } = useGraph()
  const [metricNode, setMetricNode] = useState<Node | undefined>(undefined)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState('')
  const [outputs, setOutputs] = useState('')
  const [owner, setOwner] = useState('') // TODO: make a graph object
  const [source, setSource] = useState('')

  const { editingEnabled } = useEditability()

  const populateMetricNode = useCallback(() => {
    if (metricId) {
      setMetricNode(graph.nodes.find((node) => node.id === metricId))
    }
  }, [graph, metricId])
  useEffect(() => {
    populateMetricNode()
  }, [populateMetricNode])

  const populateDetails = useCallback(() => {
    if (metricNode) {
      setName(metricNode.data.name)
      setDescription(metricNode.data.description)
      setOwner(metricNode.data.owner)
      setSource(metricNode.data.source)
    }
  }, [metricNode])
  useEffect(() => {
    populateDetails()
  }, [populateDetails])

  const FUNCTION_TYPE_ID_MARKER_PREFIX = 'functionTypeId:'
  const populateInputsAndOutputs = useCallback(() => {
    let newInputs = ''
    let newOutputs = ''
    if (metricNode && getConnectedObjects) {
      const metricConnectedObjects = getConnectedObjects(metricNode)
      const metricConnectedIdentities = metricConnectedObjects.filter(
        (metricConnectedObject) =>
          metricConnectedObject.type === 'function' &&
          graph.edges.filter(
            (edge) => edge.data.targetId === metricConnectedObject.id
          ).length === 1
      )
      metricConnectedIdentities.forEach((metricConnectedIdentity) => {
        const formulaObjects = [metricConnectedIdentity].concat(
          getConnectedObjects(metricConnectedIdentity)
        )
        let formulaObjectsSorted: (Node<any> | Edge<any>)[] = []
        // add output metric
        const outputMetric = formulaObjects.find(
          (formulaObject) =>
            formulaObject.type === 'metric' &&
            graph.edges.find(
              (edge) =>
                edge.data.targetId === formulaObject.id &&
                edge.data.sourceId === metricConnectedIdentity.id
            )
        )
        if (outputMetric) {
          formulaObjectsSorted.push(outputMetric)
        }
        // add subsequent objects
        while (
          formulaObjectsSorted.length > 0 &&
          formulaObjectsSorted.length < formulaObjects.length
        ) {
          const lastObject =
            formulaObjectsSorted[formulaObjectsSorted.length - 1]!
          if (['function', 'metric'].includes(lastObject.type!)) {
            const nextObject = formulaObjects.find(
              (formulaObject) =>
                formulaObject.type === 'input' &&
                'target' in formulaObject &&
                formulaObject.target === lastObject.id
            )
            formulaObjectsSorted.push(nextObject!)
          } else {
            // lastObject.type === 'input'
            const nextObject = formulaObjects.find(
              (formulaObject) =>
                'source' in lastObject && formulaObject.id === lastObject.source
            )
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
            inputsOrOutputs,
            inputsOrOutputs.length > 0 ? '\n\n' : '',
            formulaObjectsSorted
              .map((formulaObject) => {
                if (formulaObject.type === 'metric') {
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
        if (formulaObjectsSorted[0].id === metricId) {
          newInputs = expand(newInputs)
        } else {
          newOutputs = expand(newOutputs)
        }
      })
    }
    setInputs(newInputs)
    setOutputs(newOutputs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricNode, graph, getConnectedObjects])
  useEffect(() => {
    populateInputsAndOutputs()
  }, [populateInputsAndOutputs])

  const functionTypeIdRegex = RegExp(
    FUNCTION_TYPE_ID_MARKER_PREFIX + '([\\w-]+)'
  )
  const replaceFunctionTypeIdWithSymbol = useCallback(
    async (str: string) => {
      const matches = str.match(functionTypeIdRegex)
      if (matches) {
        const symbol = await getFunctionSymbol(matches[1])
        return str.replace(matches[0], symbol)
      } else {
        return str
      }
    },
    [functionTypeIdRegex]
  )
  useEffect(() => {
    if (inputs) {
      replaceFunctionTypeIdWithSymbol(inputs).then(setInputs)
    }
  }, [inputs, replaceFunctionTypeIdWithSymbol])
  useEffect(() => {
    if (outputs) {
      replaceFunctionTypeIdWithSymbol(outputs).then(setOutputs)
    }
  }, [outputs, replaceFunctionTypeIdWithSymbol])

  const saveDetail = useCallback(
    (name: string, value: string) => {
      if (metricNode) {
        const newData = {
          ...metricNode.data,
          [name]: value,
        }
        metricNode.data.setNodeDataToChange(newData)
      }
    },
    [metricNode]
  )

  return (
    <div className={styles.metric_detail}>
      <div className={styles.header}>
        {editingEnabled ? null : (
          <Button
            id='back-to-graphviewer-button'
            className="p-button-text"
            icon="pi pi-angle-left"
            onClick={() => {
              router.push('/' + organizationName)
            }}
          />
        )}
        <h1>
          <EditText
            className={
              editingEnabled
                ? styles.detail_field_editable
                : styles.detail_field
            }
            value={name}
            readonly={!editingEnabled}
            onChange={(e) => setName(e.target.value)}
            onSave={({ value }) => saveDetail('name', value)}
          />
        </h1>
        <ControlPanel />
      </div>
      <div className={styles.detail_field}>Chart TBA</div>
      <h2>Description</h2>
      <EditTextarea
        className={
          editingEnabled ? styles.detail_field_editable : styles.detail_field
        }
        name="description"
        value={description}
        readonly={!editingEnabled}
        placeholder={editingEnabled ? 'Add...' : '-'}
        onChange={(e) => setDescription(e.target.value)}
        onSave={({ value }) => saveDetail('description', value)}
      />
      <h2>Inputs</h2>
      {/* inputs set via function editor */}
      <EditTextarea
        className={styles.detail_field}
        value={inputs.match(functionTypeIdRegex) ? '' : inputs}
        readonly={true}
        placeholder={'-'}
      />
      <h2>Outputs</h2>
      {/* outputs set via function editor */}
      <EditTextarea
        className={styles.detail_field}
        value={outputs.match(functionTypeIdRegex) ? '' : outputs}
        readonly={true}
        placeholder={'-'}
      />
      <h2>Owner</h2>
      <EditText
        className={
          editingEnabled ? styles.detail_field_editable : styles.detail_field
        }
        value={owner}
        readonly={!editingEnabled}
        placeholder={editingEnabled ? 'Add...' : '-'}
        onChange={(e) => setOwner(e.target.value)}
        onSave={({ value }) => saveDetail('owner', value)}
      />
      <h2>Source</h2>
      <EditTextarea
        className={
          editingEnabled ? styles.detail_field_editable : styles.detail_field
        }
        value={source}
        readonly={!editingEnabled}
        placeholder={editingEnabled ? 'Add...' : '-'}
        onChange={(e) => setSource(e.target.value)}
        onSave={({ value }) => saveDetail('source', value)}
      />
      {editingEnabled ? (
        <div className={styles.editor_dock}>
          <Toolbar right={<UndoRedoSaveAndCancelGraphEditingButtons />} />
        </div>
      ) : null}
    </div>
  )
}

export default MetricDetail
