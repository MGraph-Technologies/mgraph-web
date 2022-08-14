import { useRouter } from 'next/router'
import { Button } from 'primereact/button'
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import { EditText, EditTextarea } from 'react-edit-text'
import { Edge, Node } from 'react-flow-renderer'
import 'react-edit-text/dist/index.css'

import { getFunctionSymbol } from '../../../components/GraphViewer/FunctionNode'
import { useAuth } from '../../../contexts/auth'
import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'
import styles from '../../../styles/MetricDetail.module.css'
import { supabase } from '../../../utils/supabaseClient'

type MetricDetailProps = {}
const MetricDetail: FunctionComponent<MetricDetailProps> = () => {
  const router = useRouter()
  const { organizationName, metricId } = router.query
  const { organizationName: userOrganizationName } = useAuth()

  const { graph, getConnectedObjects } = useGraph()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState('')
  const [outputs, setOutputs] = useState('')
  const [owner, setOwner] = useState('') // TODO: make a graph object
  const [source, setSource] = useState('')

  const { editingEnabled } = useEditability()

  async function populateDetails() {
    if (metricId) {
      try {
        let { data, error, status } = await supabase
          .from('nodes')
          .select('properties, node_types!inner(*)')
          .eq('id', metricId)
          .eq('node_types.name', 'metric')

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setName(data[0].properties.name)
          setDescription(data[0].properties.description)
          setOwner(data[0].properties.owner)
          setSource(data[0].properties.source)
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }
  useEffect(() => {
    populateDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId])

  const FUNCTION_TYPE_ID_MARKER_PREFIX = 'functionTypeId:'
  const populateInputsAndOutputs = useCallback(() => {
    const thisMetricNode = graph.nodes.find(node => node.id === metricId)
    if (thisMetricNode && getConnectedObjects) {
      const metricConnectedObjects = getConnectedObjects(thisMetricNode)
      const metricConnectedIdentities = metricConnectedObjects.filter(metricConnectedObject => (
        metricConnectedObject.type === 'function' && 
        graph.edges.filter(edge => edge.data.targetId === metricConnectedObject.id).length === 1
      ))
      metricConnectedIdentities.forEach(metricConnectedIdentity => {
        const formulaObjects = [metricConnectedIdentity].concat(getConnectedObjects(metricConnectedIdentity))
        let formulaObjectsSorted: (Node<any> | Edge<any>)[] = []
        // add output metric
        const outputMetric = (
          formulaObjects.find(formulaObject => (
            formulaObject.type === 'metric' &&
            graph.edges.find(edge => edge.data.targetId === formulaObject.id && edge.data.sourceId === metricConnectedIdentity.id)
          ))
        )
        if (outputMetric) {
          formulaObjectsSorted.push(outputMetric)
        }
        // add subsequent objects
        while (formulaObjectsSorted.length > 0 && formulaObjectsSorted.length < formulaObjects.length) {
          const lastObject = formulaObjectsSorted[formulaObjectsSorted.length - 1]!
          if (['function', 'metric'].includes(lastObject.type!)) {
            const nextObject = (
              formulaObjects.find(formulaObject => (
                formulaObject.type === 'input' && 'target' in formulaObject && formulaObject.target === lastObject.id
              ))
            )
            formulaObjectsSorted.push(nextObject!)
          } else { // lastObject.type === 'input'
            const nextObject = (
              formulaObjects.find(formulaObject => (
                'source' in lastObject && formulaObject.id === lastObject.source
              ))
            )
            formulaObjectsSorted.push(nextObject!)
          }
        }
        // remove edges and sort to match order in which entered
        formulaObjectsSorted = formulaObjectsSorted.filter(formulaObject => formulaObject.type !== 'input')
        formulaObjectsSorted = formulaObjectsSorted.slice(0, 2).concat(formulaObjectsSorted.slice(2).reverse())
        // concatenate formula to input or output as appropriate
        if (formulaObjectsSorted[0].id === metricId) {
          setInputs(
            inputs.concat(
              inputs,
              inputs.length > 0 ? '\n\n' : '',
              formulaObjectsSorted.map(formulaObject => {
                if (formulaObject.type === 'metric') {
                  return formulaObject.data.name
                } else if (formulaObject.type === 'function') {
                  // subsequently replaced by replaceFunctionTypeIdWithSymbol
                  return FUNCTION_TYPE_ID_MARKER_PREFIX + formulaObject.data.functionTypeId
                }
              }).join(' ')
            )
          )
        } else {
          setOutputs(
            outputs.concat(
              outputs,
              outputs.length > 0 ? '\n\n' : '',
              formulaObjectsSorted.map(formulaObject => {
                if (formulaObject.type === 'metric') {
                  return formulaObject.data.name
                } else if (formulaObject.type === 'function') {
                  return FUNCTION_TYPE_ID_MARKER_PREFIX + formulaObject.data.functionTypeId
                }
              }).join(' ')
            )
          )
        }
      })
    } else {
      setInputs('')
      setOutputs('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId, graph, getConnectedObjects])
  useEffect(() => {
    populateInputsAndOutputs()
  }, [populateInputsAndOutputs])

  const functionTypeIdRegex = RegExp(FUNCTION_TYPE_ID_MARKER_PREFIX + '([\\w-]+)')
  const replaceFunctionTypeIdWithSymbol = useCallback(async (str: string) => {
    const matches = str.match(functionTypeIdRegex)
    if (matches) {
      const symbol = await getFunctionSymbol(matches[1])
      return str.replace(matches[0], symbol)
    } else {
      return str
    }
  }, [functionTypeIdRegex])
  useEffect(() => {
    if (inputs) {
      replaceFunctionTypeIdWithSymbol(inputs).then(setInputs)
    }
  } , [inputs, replaceFunctionTypeIdWithSymbol])
  useEffect(() => {
    if (outputs) {
      replaceFunctionTypeIdWithSymbol(outputs).then(setOutputs)
    }
  } , [outputs, replaceFunctionTypeIdWithSymbol])

  return (
    organizationName === userOrganizationName ? (
      <div className={styles.container}>
        <div className={styles.header}>
          <Button
            className="p-button-text"
            icon="pi pi-angle-left"
            onClick={() => {
              router.push('/' + organizationName)
            }}
          />
          <h1>
            <EditText
              value={name}
              readonly={!editingEnabled}
              onChange={(e) => setName(e.target.value)}
              // onSave={saveProperties}
            />
          </h1>
        </div>
        <div className={styles.detail_field}>
          Chart TBA
        </div>
        <h2>Description</h2>
        <div className={styles.detail_field}>
          <EditTextarea
            value={description}
            readonly={!editingEnabled}
            placeholder={ editingEnabled ? 'Add...' : '-' }
            style={{ backgroundColor: editingEnabled ? '#EEE': '#F8F8F8' }}
            onChange={(e) => setDescription(e.target.value)}
            // onSave={saveProperties}
          />
        </div>
        <h2>Inputs</h2>
        <div className={styles.detail_field}>
          {/* inputs set via function editor */}
          <EditTextarea
            value={inputs.match(functionTypeIdRegex) ? '' : inputs}
            readonly={true}
            placeholder={ '-' }
            style={{ backgroundColor: '#F8F8F8' }}
          />
        </div>
        <h2>Outputs</h2>
        <div className={styles.detail_field}>
          {/* outputs set via function editor */}
          <EditTextarea
            value={outputs.match(functionTypeIdRegex) ? '' : outputs}
            readonly={true}
            placeholder={ '-' }
            style={{ backgroundColor: '#F8F8F8' }}
          />
        </div>
        <h2>Owner</h2>
        <div className={styles.detail_field}>
          <EditText
            value={owner}
            readonly={!editingEnabled}
            placeholder={ editingEnabled ? 'Add...' : '-' }
            style={{ backgroundColor: editingEnabled ? '#EEE': '#F8F8F8' }}
            onChange={(e) => setOwner(e.target.value)}
            // onSave={saveProperties}
          />
        </div>
        <h2>Source</h2>
        <div className={styles.detail_field}>
          <EditTextarea
            value={source}
            readonly={!editingEnabled}
            placeholder={ editingEnabled ? 'Add...' : '-' }
            style={{ backgroundColor: editingEnabled ? '#EEE': '#F8F8F8' }}
            onChange={(e) => setSource(e.target.value)}
            // onSave={saveProperties}
          />
        </div>
      </div>
    ) : (
      null
    )
  )
}

export default MetricDetail
