import jsYaml from 'js-yaml'
import Head from 'next/head'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { Toolbar } from 'primereact/toolbar'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { EditText, EditTextarea } from 'react-edit-text'
import { Edge, Node } from 'react-flow-renderer'
import Editor from 'react-simple-code-editor'
import 'react-edit-text/dist/index.css'

import { QueryResult, QueryRunner } from '../../components/graph/QueryRunner'
import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import { useBrowser } from '../../contexts/browser'
import styles from '../../styles/MetricDetail.module.css'
import { highlight } from '../../utils/codeHighlighter'
import { supabase } from '../../utils/supabaseClient'
import LineChart from '../LineChart'
import ControlPanel from './ControlPanel'
import UndoRedoSaveAndCancelGraphEditingButtons from './editing/UndoRedoSaveAndCancelGraphEditingButtons'
import {
  MetricNodeProperties,
  MetricNodeSource,
  SourceQueryType,
} from './MetricNode'

type MetricDetailProps = {
  metricId: string | string[] | undefined
}
const MetricDetail: FunctionComponent<MetricDetailProps> = ({ metricId }) => {
  const { session, organizationId, organizationName } = useAuth()
  const { editingEnabled } = useEditability()
  const { push } = useBrowser()

  const { graph, getFunctionSymbol, getConnectedObjects } = useGraph()
  const [metricNode, setMetricNode] = useState<Node | undefined>(undefined)
  type GraphSync = {
    id: string
    name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: any
    graph_sync_types: {
      name: string
    }
  }
  const [graphSyncs, setGraphSyncs] = useState<GraphSync[]>([])
  type DatabaseConnection = {
    id: string
    name: string
  }
  const [databaseConnections, setDatabaseConnections] = useState<
    DatabaseConnection[]
  >([])

  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState('')
  const [outputs, setOutputs] = useState('')
  const [sourceDatabaseConnection, setSourceDatabaseConnection] =
    useState<DatabaseConnection | null>(null)
  const [sourceDbtProjectGraphSync, setSourceDbtProjectGraphSync] =
    useState<GraphSync | null>(null)
  const [sourceDbtProjectMetricPath, setSourceDbtProjectMetricPath] = useState<
    string | null
  >(null)
  const [sourceDbtMetricYaml, setSourceDbtMetricYaml] = useState('')
  const [sourceQueryType, setSourceQueryType] =
    useState<SourceQueryType>('freeform')
  const sourceQueryTypes = [
    {
      label: 'freeform' as SourceQueryType,
      value: 'freeform' as SourceQueryType,
    },
    {
      label: 'generated' as SourceQueryType,
      value: 'generated' as SourceQueryType,
    },
  ]
  const [sourceQuery, setSourceQuery] = useState('')
  const [queryRunnerRefreshes, setQueryRunnerRefreshes] = useState(0)
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

  const populateDatabaseConnections = useCallback(async () => {
    if (organizationId) {
      try {
        const { data, error, status } = await supabase
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
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateDatabaseConnections()
  }, [populateDatabaseConnections])

  const populateGraphSyncs = useCallback(async () => {
    if (organizationId) {
      try {
        const { data, error, status } = await supabase
          .from('graph_syncs')
          .select('id, name, properties, graph_sync_types!inner ( name )')
          .match({
            organization_id: organizationId,
            'graph_sync_types.name': 'dbt Project', // ignore other types
          })
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
          setGraphSyncs(
            [
              {
                id: '',
                name: '(none)',
                properties: {},
                graph_sync_types: {
                  name: '',
                },
              },
            ].concat(data)
          )
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateGraphSyncs()
  }, [populateGraphSyncs])

  const populateDetails = useCallback(() => {
    setName(metricNode?.data.name || '')
    setOwner(metricNode?.data.owner || '')
    setDescription(metricNode?.data.description || '')
    setSourceDatabaseConnection(
      databaseConnections.find(
        (databaseConnection) =>
          databaseConnection.id === metricNode?.data.source.databaseConnectionId
      ) || null
    )
    setSourceDbtProjectGraphSync(
      graphSyncs.find(
        (graphSync) =>
          graphSync.id === metricNode?.data.source.dbtProjectGraphSyncId
      ) || null
    )
    setSourceDbtProjectMetricPath(metricNode?.data.source.dbtProjectMetricPath)
    setSourceQueryType(
      (metricNode?.data.source.queryType as SourceQueryType) || 'freeform'
    )
    setSourceQuery(metricNode?.data.source.query || '')
  }, [metricNode, databaseConnections, graphSyncs])
  useEffect(() => {
    populateDetails()
  }, [populateDetails])

  const FUNCTION_TYPE_ID_MARKER_PREFIX = 'functionTypeId:'
  const populateInputsAndOutputs = useCallback(() => {
    let newInputs = ''
    let newOutputs = ''
    if (metricNode && getConnectedObjects) {
      const metricConnectedObjects = getConnectedObjects(metricNode, 1)
      const metricConnectedIdentities = metricConnectedObjects.filter(
        (metricConnectedObject) =>
          metricConnectedObject.type === 'function' &&
          graph.edges.filter(
            (edge) => edge.data.targetId === metricConnectedObject.id
          ).length === 1
      )
      metricConnectedIdentities.forEach((metricConnectedIdentity) => {
        const formulaObjects = [metricConnectedIdentity].concat(
          getConnectedObjects(metricConnectedIdentity, 1)
        )
        let formulaObjectsSorted: (Node | Edge)[] = []
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            formulaObjectsSorted[formulaObjectsSorted.length - 1]!
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (['function', 'metric', 'mission'].includes(lastObject.type!)) {
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
    (name: keyof MetricNodeProperties, value: string | MetricNodeSource) => {
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

  const getDbtMetricYaml = useCallback(async () => {
    if (
      sourceDbtProjectGraphSync?.id &&
      metricNode?.data?.source?.dbtProjectMetricPath
      /* ^use this, rather than sourceDbtProjectMetricPath, so we don't 
      hit github on every keystroke */
    ) {
      const accessToken = session?.access_token
      if (!accessToken) {
        return ''
      }

      // get dbt project graph sync client token
      const clientTokenResp = await fetch(
        `/api/v1/graph-syncs/${sourceDbtProjectGraphSync.id}/client-tokens`,
        {
          method: 'GET',
          headers: {
            'supabase-access-token': accessToken,
          },
        }
      )
      if (clientTokenResp.status !== 200) {
        console.error('Error getting dbt project graph sync client token')
        return ''
      }
      const clientTokenBody = await clientTokenResp.json()
      const clientToken = clientTokenBody?.token
      if (!clientToken) {
        console.error('Error materializing dbt project graph sync client token')
        return ''
      }

      // parse repoUrl
      const repoUrl = sourceDbtProjectGraphSync.properties.repoUrl || ''
      const owner = repoUrl.split('/')[3]
      const repo = repoUrl.split('/')[4]
      if (!owner || !repo) {
        console.error(
          'Error parsing owner and repo from dbt project graph sync repo url'
        )
        return ''
      }

      // parse file path and metric name
      const [filePath, metricName] =
        // eslint-disable-next-line no-unsafe-optional-chaining
        metricNode?.data?.source?.dbtProjectMetricPath.split(':')

      // load and decode corresponding content from github
      const contentResp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${clientToken}`,
          },
        }
      )
      if (contentResp.status !== 200) {
        console.error('Error getting dbt metric file content')
        return ''
      }
      const contentRespBody = await contentResp.json()
      const encodedContent = contentRespBody.content
      const decodedContent = Buffer.from(encodedContent, 'base64').toString(
        'utf-8'
      )

      // parse yaml
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonifiedContent = jsYaml.load(decodedContent) as any
      if (!jsonifiedContent) {
        console.error('Error jsonifying dbt metric file content')
        return ''
      }

      // get metric definition
      const metrics = jsonifiedContent.metrics || []
      const metric = metrics.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (metric: any) => metric.name === metricName
      )
      if (!metric) {
        console.error('Error getting metric definition')
        return ''
      }

      return jsYaml.dump(metric)
    } else {
      return ''
    }
  }, [
    sourceDbtProjectGraphSync,
    metricNode?.data?.source?.dbtProjectMetricPath,
    session,
  ])
  useEffect(() => {
    const f = async () => {
      const _sourceDbtMetricYaml = await getDbtMetricYaml()
      setSourceDbtMetricYaml(_sourceDbtMetricYaml || '')
    }
    f()
  }, [getDbtMetricYaml])

  const generateDbtMetricSql = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metric = jsYaml.load(sourceDbtMetricYaml) as any
    const queryTemplate =
      sourceDbtProjectGraphSync?.properties?.generatedQueryTemplate
    if (metric && queryTemplate) {
      return queryTemplate.replace(/{{\s*metric_name\s*}}/g, metric.name)
    } else {
      return ''
    }
  }, [
    sourceDbtMetricYaml,
    sourceDbtProjectGraphSync?.properties?.generatedQueryTemplate,
  ])
  useEffect(() => {
    if (editingEnabled && sourceQueryType === 'generated') {
      const dbtMetricSql = generateDbtMetricSql()
      setSourceQuery(dbtMetricSql)
      if (dbtMetricSql !== metricNode?.data?.source?.query) {
        // avoid infinite loop
        saveDetail('source', {
          ...metricNode?.data?.source,
          query: dbtMetricSql,
        })
      }
    }
  }, [
    editingEnabled,
    sourceQueryType,
    generateDbtMetricSql,
    metricNode?.data?.source,
    saveDetail,
  ])

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
          value={name}
          readonly={!editingEnabled}
          formatDisplayText={(value) => {
            return editingEnabled ? value : `Metric: ${value}`
          }}
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
            parentMetricNodeData={metricNode?.data}
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
        <EditTextarea
          className={styles.detail_field}
          value={inputs.match(functionTypeIdRegex) ? '' : inputs.trim()}
          readonly={true}
          placeholder={'-'}
          rows={
            inputs.match(functionTypeIdRegex)
              ? 1
              : Math.max(inputs.split('\n').filter((n) => n).length, 1)
          }
        />
        <h2>Outputs</h2>
        {/* outputs set via function editor */}
        <EditTextarea
          className={styles.detail_field}
          value={outputs.match(functionTypeIdRegex) ? '' : outputs.trim()}
          readonly={true}
          placeholder={'-'}
          rows={
            outputs.match(functionTypeIdRegex)
              ? 1
              : Math.max(outputs.split('\n').filter((n) => n).length, 1)
          }
        />
        <h2>Source</h2>
        <h3>Database</h3>
        <div className={styles.connection_config_block}>
          <div className={styles.connection_config}>
            <Dropdown
              id="source-database-connection-dropdown"
              className={styles.connection_config_value}
              value={sourceDatabaseConnection?.name || ''}
              options={databaseConnections.map((dc) => dc.name)}
              onChange={(e) => {
                const newSourceDatabaseConnection = databaseConnections.find(
                  (dc) => dc.name === e.value
                )
                if (newSourceDatabaseConnection) {
                  saveDetail('source', {
                    ...metricNode?.data?.source,
                    databaseConnectionId: newSourceDatabaseConnection.id,
                  })
                  // name updating handled by useEffect above
                }
              }}
              disabled={!editingEnabled}
              tooltip="The database on which query will be run"
            />
          </div>
        </div>
        {(editingEnabled || sourceDbtProjectGraphSync?.id) && (
          <>
            <h3>dbt Metric</h3>
            <div className={styles.connection_config_block}>
              <div className={styles.connection_config}>
                <label
                  htmlFor="source-dbt-project-graph-sync-dropdown"
                  className={styles.connection_config_label}
                >
                  Project
                </label>
                <Dropdown
                  id="source-dbt-project-graph-sync-dropdown"
                  className={styles.connection_config_value}
                  value={sourceDbtProjectGraphSync?.name || ''}
                  options={graphSyncs.map((gc) => gc.name)}
                  onChange={(e) => {
                    const newSourceDbtProjectGraphSync = graphSyncs.find(
                      (gs) => gs.name === e.value
                    )
                    if (newSourceDbtProjectGraphSync) {
                      saveDetail('source', {
                        ...metricNode?.data?.source,
                        dbtProjectGraphSyncId: newSourceDbtProjectGraphSync.id,
                      })
                    }
                  }}
                  disabled={!editingEnabled}
                  emptyMessage="No dbt project graph syncs configured"
                  tooltip="The dbt project graph sync from which to draw metric definition"
                />
              </div>
              {sourceDbtProjectGraphSync?.id && (
                <div className={styles.connection_config}>
                  <label
                    htmlFor="source-dbt-project-path-field"
                    className={styles.connection_config_label}
                  >
                    Path
                  </label>
                  <InputText
                    id="source-dbt-project-path-field"
                    className={styles.connection_config_value}
                    value={sourceDbtProjectMetricPath || ''}
                    onChange={(e) => {
                      setSourceDbtProjectMetricPath(e.target.value)
                    }}
                    onBlur={() => {
                      saveDetail('source', {
                        ...metricNode?.data?.source,
                        dbtProjectMetricPath: sourceDbtProjectMetricPath,
                      })
                    }}
                    disabled={!editingEnabled}
                    tooltip="Path to dbt metric definition within project; e.g., models/marts/schema.yml:new_users"
                  />
                </div>
              )}
            </div>
            {sourceDbtProjectGraphSync?.id && (
              <>
                <br />
                <div>Definition</div>
                <pre>
                  {highlight(
                    sourceDbtMetricYaml || '(metric not found)',
                    'yaml'
                  )}
                </pre>
              </>
            )}
          </>
        )}
        <h3>
          Query
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
        {(editingEnabled || sourceDbtProjectGraphSync?.id) && (
          <>
            <div className={styles.connection_config_block}>
              <div className={styles.connection_config}>
                <label
                  htmlFor="source-query-type-dropdown"
                  className={styles.connection_config_label}
                >
                  Type
                </label>
                <Dropdown
                  id="source-query-type-dropdown"
                  className={styles.connection_config_value}
                  value={sourceQueryType}
                  options={sourceQueryTypes}
                  onChange={(e) => {
                    const newSQT = e.value as SourceQueryType
                    setSourceQueryType(newSQT)
                    saveDetail('source', {
                      ...metricNode?.data?.source,
                      queryType: newSQT,
                    })
                  }}
                  style={{ marginBottom: '1em' }}
                  disabled={!editingEnabled}
                  tooltip="Whether query will be user-inputted or auto-generated from a dbt metric"
                />
              </div>
            </div>
            {sourceQueryType === 'generated' && <div>Generated SQL</div>}
          </>
        )}
        {editingEnabled && sourceQueryType === 'freeform' ? (
          <Editor
            id="source-query-field"
            value={sourceQuery}
            onValueChange={(query) => setSourceQuery(query)}
            onBlur={() => {
              saveDetail('source', {
                ...metricNode?.data?.source,
                query: sourceQuery,
              })
            }}
            highlight={(query) => highlight(query, 'sql')}
            textareaClassName="react-simple-code-editor-textarea"
          />
        ) : (
          <pre>{highlight(sourceQuery, 'sql')}</pre>
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
