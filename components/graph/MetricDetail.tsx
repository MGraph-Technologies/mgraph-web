import hljs from 'highlight.js/lib/core'
import plaintext from 'highlight.js/lib/languages/plaintext'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/docco.css'
import Head from 'next/head'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { Toolbar } from 'primereact/toolbar'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { EditText, EditTextarea } from 'react-edit-text'
import { Edge, Node } from 'react-flow-renderer'
import Editor from 'react-simple-code-editor'
import 'react-edit-text/dist/index.css'

import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import { useBrowser } from '../../contexts/browser'
import styles from '../../styles/MetricDetail.module.css'
import { supabase } from '../../utils/supabaseClient'
import LineChart from '../LineChart'
import QueryRunner, { QueryResult } from '../QueryRunner'
import ControlPanel from './ControlPanel'
import UndoRedoSaveAndCancelGraphEditingButtons from './editing/UndoRedoSaveAndCancelGraphEditingButtons'
import { getFunctionSymbol } from './FunctionNode'
import { SourceCodeLanguage } from './MetricNode'

hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)

type MetricDetailProps = {
  metricId: string | string[] | undefined
}
const MetricDetail: FunctionComponent<MetricDetailProps> = ({ metricId }) => {
  const { organizationId, organizationName } = useAuth()
  const { editingEnabled } = useEditability()
  const { push } = useBrowser()

  const { graph, getConnectedObjects } = useGraph()
  const [metricNode, setMetricNode] = useState<Node | undefined>(undefined)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState('')
  const [outputs, setOutputs] = useState('')
  const [owner, setOwner] = useState('')
  const [sourceCode, setSourceCode] = useState('')
  const [sourceCodeLanguage, setSourceCodeLanguage] = useState('')
  const sourceCodeLanguages = [
    { label: 'SQL', value: 'sql' as SourceCodeLanguage },
    { label: 'YAML (dbt Metrics)', value: 'yaml' as SourceCodeLanguage },
  ]
  const [sourceDatabaseConnectionId, setSourceDatabaseConnectionId] =
    useState('')
  const [sourceDatabaseConnectionName, setSourceDatabaseConnectionName] =
    useState('')
  const [sourceSyncId, setSourceSyncId] = useState('')
  const [sourceSyncPath, setSourceSyncPath] = useState('')
  const [queryRunnerRefreshes, setQueryRunnerRefreshes] = useState(0)
  const [initialDetailPopulationComplete, setInitialDetailPopulationComplete] =
    useState(false)

  const [databaseConnections, setDatabaseConnections] = useState<any[]>([])

  const [queryResult, setQueryResult] = useState<QueryResult>({
    status: 'processing',
    data: null,
  })

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
      // execute source code on canceled change
      // (we also execute on EditTextarea-saved change below)
      if (
        initialDetailPopulationComplete &&
        (metricNode.data.sourceCode !== sourceCode ||
          metricNode.data.sourceCodeLanguage !== sourceCodeLanguage ||
          metricNode.data.sourceDatabaseConnectionId !==
            sourceDatabaseConnectionId ||
          metricNode.data.sourceSyncId !== sourceSyncId ||
          metricNode.data.sourceSyncPath !== sourceSyncPath)
      ) {
        setQueryRunnerRefreshes(queryRunnerRefreshes + 1)
      }
      setName(metricNode.data.name || '')
      setDescription(metricNode.data.description || '')
      setOwner(metricNode.data.owner || '')
      const _sourceCode = metricNode.data.sourceCode || ''
      setSourceCode(_sourceCode)
      const _sourceCodeLanguage = metricNode.data.sourceCodeLanguage || ''
      setSourceCodeLanguage(_sourceCodeLanguage)
      const _sourceDatabaseConnectionId =
        metricNode.data.sourceDatabaseConnectionId || ''
      setSourceDatabaseConnectionId(_sourceDatabaseConnectionId)
      const _sourceSyncId = metricNode.data.sourceSyncId || ''
      setSourceSyncId(_sourceSyncId)
      const _sourceSyncPath = metricNode.data.sourceSyncPath || ''
      setSourceSyncPath(_sourceSyncPath)
      if (
        !_sourceCode ||
        !_sourceCodeLanguage ||
        !_sourceDatabaseConnectionId ||
        (_sourceCodeLanguage === 'yaml' && (!_sourceSyncId || !_sourceSyncPath))
      ) {
        setQueryResult({
          status: 'empty',
          data: null,
        })
      }
      setInitialDetailPopulationComplete(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // add output
        const output = formulaObjects.find(
          (formulaObject) =>
            (formulaObject.type === 'metric' ||
              formulaObject.type === 'mission') &&
            graph.edges.find(
              (edge) =>
                edge.data.targetId === formulaObject.id &&
                edge.data.sourceId === metricConnectedIdentity.id
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
            formulaObjectsSorted[formulaObjectsSorted.length - 1]!
          if (['function', 'metric', 'mission'].includes(lastObject.type!)) {
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
            inputsOrOutputs.length > 0 ? '\n\n' : '',
            formulaObjectsSorted
              .map((formulaObject) => {
                if (formulaObject.type === 'mission') {
                  return 'Mission'
                } else if (formulaObject.type === 'metric') {
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
        let symbol = await getFunctionSymbol(matches[1])
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

  const populateDatabaseConnections = useCallback(async () => {
    if (organizationId) {
      try {
        let { data, error, status } = await supabase
          .from('database_connections')
          .select('id, name')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          data.sort((a, b) => {
            if (a.name < b.name) {
              return -1
            }
            if (a.name > b.name) {
              return 1
            }
            return 0
          })
          setDatabaseConnections(data)
        }
      } catch (error: any) {
        console.error(error.message)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateDatabaseConnections()
  }, [populateDatabaseConnections])
  useEffect(() => {
    const sourceDatabaseConnection = databaseConnections.find(
      (databaseConnection) =>
        databaseConnection.id === sourceDatabaseConnectionId
    )
    if (sourceDatabaseConnection) {
      setSourceDatabaseConnectionName(sourceDatabaseConnection.name)
    } else {
      setSourceDatabaseConnectionName('')
    }
  }, [
    sourceDatabaseConnectionId,
    databaseConnections,
    setSourceDatabaseConnectionName,
  ])

  // https://github.com/highlightjs/highlight.js/issues/925
  const highlight = (code: string, language: string) => {
    return (
      <code
        className="hljs"
        dangerouslySetInnerHTML={{
          __html: hljs.highlight(code, { language }).value,
        }}
      />
    )
  }

  return (
    <div className={styles.metric_detail}>
      <Head>
        <title>{name ? `Metric: ${name}` : 'Metric'} — MGraph</title>
      </Head>
      <div className={styles.header}>
        <Button
          id="back-to-graphviewer-button"
          className="p-button-text"
          icon="pi pi-angle-left"
          onClick={() => {
            push('/' + organizationName)
          }}
        />
        <EditText
          id="name-field"
          className={
            editingEnabled ? styles.detail_field_editable : styles.detail_field
          }
          value={'Metric: ' + name}
          readonly={!editingEnabled}
          style={{
            fontSize: '2em',
            fontWeight: 'bold',
          }}
          onChange={(e) => setName(e.target.value)}
          onSave={({ value }) => saveDetail('name', value)}
        />
        <ControlPanel />
      </div>
      <div className={styles.body}>
        <div className={styles.chart_container}>
          <QueryRunner
            statement={sourceCode}
            databaseConnectionId={sourceDatabaseConnectionId}
            parentNodeId={metricNode ? metricNode.id : ''}
            refreshes={queryRunnerRefreshes}
            queryResult={queryResult}
            setQueryResult={setQueryResult}
          />
          <LineChart queryResult={queryResult} />
        </div>
        <h2>Owner</h2>
        <EditText
          id="owner-field"
          className={
            editingEnabled ? styles.detail_field_editable : styles.detail_field
          }
          value={owner}
          readonly={!editingEnabled}
          placeholder={editingEnabled ? 'Add...' : '-'}
          onChange={(e) => setOwner(e.target.value)}
          onSave={({ value }) => saveDetail('owner', value)}
        />
        <h2>Description</h2>
        <EditTextarea
          id="description-field"
          className={
            editingEnabled ? styles.detail_field_editable : styles.detail_field
          }
          value={description}
          readonly={!editingEnabled}
          placeholder={editingEnabled ? 'Add...' : '-'}
          onChange={(e) => setDescription(e.target.value)}
          onSave={({ value }) => saveDetail('description', value)}
        />
        <h2>Inputs</h2>
        {/* inputs set via function editor */}
        <pre>
          <code>
            <EditTextarea
              className={styles.detail_field}
              value={inputs.match(functionTypeIdRegex) ? '' : inputs}
              readonly={true}
              placeholder={'-'}
            />
          </code>
        </pre>
        <h2>Outputs</h2>
        {/* outputs set via function editor */}
        <pre>
          <code>
            <EditTextarea
              className={styles.detail_field}
              value={outputs.match(functionTypeIdRegex) ? '' : outputs}
              readonly={true}
              placeholder={'-'}
            />
          </code>
        </pre>
        <h2>Source</h2>
        <h3>Database</h3>
        <Dropdown
          id="source-database-connection-dropdown"
          value={sourceDatabaseConnectionName}
          options={databaseConnections.map((dc) => dc.name)}
          onChange={(e) => {
            const newSourceDatabaseConnection = databaseConnections.find(
              (dc) => dc.name === e.value
            )
            if (newSourceDatabaseConnection) {
              setSourceDatabaseConnectionId(newSourceDatabaseConnection.id)
              saveDetail(
                'sourceDatabaseConnectionId',
                newSourceDatabaseConnection.id
              )
              setQueryRunnerRefreshes(queryRunnerRefreshes + 1)
              // name updating handled by useEffect above
            }
          }}
          disabled={!editingEnabled}
        />
        <h3>
          Code
          {editingEnabled && (
            <Button
              id="refresh-query-button"
              className="p-button-text p-button-sm"
              icon="pi pi-refresh"
              onClick={() => {
                setQueryRunnerRefreshes(queryRunnerRefreshes + 1)
              }}
              style={{ marginLeft: '1em' }}
            />
          )}
        </h3>
        <label
          htmlFor="source-code-language-dropdown"
          style={{ marginRight: '1em' }}
        >
          Language:
        </label>
        <Dropdown
          id="source-code-language-dropdown"
          value={sourceCodeLanguage}
          options={sourceCodeLanguages}
          onChange={(e) => {
            const newSCL = e.value as SourceCodeLanguage
            setSourceCodeLanguage(newSCL)
            saveDetail('sourceCodeLanguage', newSCL)
            setQueryRunnerRefreshes(queryRunnerRefreshes + 1)
          }}
          style={{ marginBottom: '1em' }}
          disabled={!editingEnabled}
        />
        {sourceCodeLanguage === 'yaml' && <p>Sync fields TBA</p>}
        {editingEnabled ? (
          <Editor
            id="source-code-field"
            value={sourceCode}
            onValueChange={(code) => setSourceCode(code)}
            onBlur={() => {
              saveDetail('sourceCode', sourceCode)
              setQueryRunnerRefreshes(queryRunnerRefreshes + 1)
            }}
            highlight={(code) =>
              highlight(code, sourceCodeLanguage || 'plaintext')
            }
            textareaClassName="react-simple-code-editor-textarea"
          />
        ) : (
          <pre>{highlight(sourceCode, sourceCodeLanguage || 'plaintext')}</pre>
        )}
      </div>
      {editingEnabled ? (
        <div className={styles.editor_dock}>
          <Toolbar right={<UndoRedoSaveAndCancelGraphEditingButtons />} />
        </div>
      ) : null}
    </div>
  )
}

export default MetricDetail
