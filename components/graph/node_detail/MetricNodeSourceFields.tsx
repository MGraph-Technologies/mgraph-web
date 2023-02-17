import jsYaml from 'js-yaml'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import Editor from 'react-simple-code-editor'
import { Node } from 'reactflow'

import SettingsRadioGroup from 'components/SettingsRadioGroup'
import {
  MetricNodeProperties,
  MetricNodeSource,
  SourceQueryType,
} from 'components/graph/MetricNode'
import { useAuth } from 'contexts/auth'
import { useEditability } from 'contexts/editability'
import styles from 'styles/NodeDetail.module.css'
import { highlight } from 'utils/codeHighlighter'
import { supabase } from 'utils/supabaseClient'

const DROPDOWN_EMPTY_OPTION = {
  id: '',
  name: '(None)',
}

type MetricNodeSourceFieldsProps = {
  metricNode: Node | undefined
  saveDetail: (
    name: keyof MetricNodeProperties,
    value: string | MetricNodeSource
  ) => void
}
const MetricNodeSourceFields: FunctionComponent<
  MetricNodeSourceFieldsProps
> = ({ metricNode, saveDetail }) => {
  const { getValidAccessToken, organizationId } = useAuth()
  const { editingEnabled } = useEditability()

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
  type SourceQueryTypeOption = {
    label: SourceQueryType
    value: SourceQueryType
  }
  const sourceQueryTypeOptions: SourceQueryTypeOption[] = [
    {
      label: 'freeform',
      value: 'freeform',
    },
    {
      label: 'generated',
      value: 'generated',
    },
  ]
  const [sourceQuery, setSourceQuery] = useState('')

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
          const _databaseConnections = data as DatabaseConnection[]
          _databaseConnections.sort((a, b) => {
            if (a.name < b.name) {
              return -1
            }
            if (a.name > b.name) {
              return 1
            }
            return 0
          })
          _databaseConnections.unshift(DROPDOWN_EMPTY_OPTION)
          setDatabaseConnections(_databaseConnections)
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
          const _graphSyncs = data as GraphSync[]
          _graphSyncs.sort((a, b) => {
            if (a.name < b.name) {
              return -1
            }
            if (a.name > b.name) {
              return 1
            }
            return 0
          })
          _graphSyncs.unshift({
            ...DROPDOWN_EMPTY_OPTION,
            properties: {},
            graph_sync_types: {
              name: '',
            },
          })
          setGraphSyncs(_graphSyncs)
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
  }, [databaseConnections, metricNode, graphSyncs])
  useEffect(() => {
    populateDetails()
  }, [populateDetails])

  const getDbtMetricYaml = useCallback(async () => {
    if (
      sourceDbtProjectGraphSync?.id &&
      metricNode?.data?.source?.dbtProjectMetricPath
      /* ^use this, rather than sourceDbtProjectMetricPath, so we don't 
      hit github on every keystroke */
    ) {
      const accessToken = getValidAccessToken()
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
    getValidAccessToken,
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
    <>
      {/***** Source Database Connection *****/}
      <div className={styles.connection_config_block}>
        <div className={styles.connection_config}>
          <label
            htmlFor="source-database-connection-dropdown"
            className={styles.connection_config_label}
          >
            Database Connection
          </label>
          <Dropdown
            id="source-database-connection-dropdown"
            className={styles.connection_config_value}
            value={sourceDatabaseConnection?.name || DROPDOWN_EMPTY_OPTION.name}
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
      {/* Only show subsequent source fields if database connection chosen */}
      {sourceDatabaseConnection?.id && (
        <>
          {/***** Source dbt Sync *****/}
          {/* Only show if 1+ syncs have been configured */}
          {graphSyncs.length > 0 && (
            <>
              <div className={styles.connection_config_block}>
                <div className={styles.connection_config}>
                  <label
                    htmlFor="source-dbt-project-graph-sync-dropdown"
                    className={styles.connection_config_label}
                  >
                    dbt Sync
                  </label>
                  <Dropdown
                    id="source-dbt-project-graph-sync-dropdown"
                    className={styles.connection_config_value}
                    value={
                      sourceDbtProjectGraphSync?.name ||
                      DROPDOWN_EMPTY_OPTION.name
                    }
                    options={graphSyncs.map((gc) => gc.name)}
                    onChange={(e) => {
                      const newSourceDbtProjectGraphSync = graphSyncs.find(
                        (gs) => gs.name === e.value
                      )
                      if (newSourceDbtProjectGraphSync) {
                        const newSource = {
                          ...metricNode?.data?.source,
                          dbtProjectGraphSyncId:
                            newSourceDbtProjectGraphSync.id,
                        }
                        if (newSourceDbtProjectGraphSync.id === '') {
                          // reset dbt project path and query type if None selected
                          setSourceDbtProjectMetricPath('')
                          newSource.dbtProjectMetricPath = ''
                          setSourceQueryType('freeform')
                          newSource.queryType = 'freeform'
                        }
                        saveDetail('source', newSource)
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
                      dbt Path
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
              {/* Only show if a sync has been chosen */}
              {sourceDbtProjectGraphSync?.id && (
                <>
                  <div className={styles.connection_config_block}>
                    <div className={styles.connection_config}>
                      <label
                        htmlFor="source-dbt-definition"
                        className={styles.connection_config_label}
                      >
                        dbt Definition
                      </label>
                    </div>
                  </div>
                  <pre
                    id="source-dbt-definition"
                    className={styles.detail_field_code}
                  >
                    {highlight(
                      sourceDbtMetricYaml || '(metric not found)',
                      'yaml'
                    )}
                  </pre>
                  <div className={styles.connection_config_block}>
                    <div className={styles.connection_config}>
                      <label
                        htmlFor="source-query-type-radio-group"
                        className={styles.connection_config_label}
                      >
                        Query Type
                      </label>
                      <SettingsRadioGroup
                        id="source-query-type-radio-group"
                        value={sourceQueryType}
                        options={sourceQueryTypeOptions}
                        onChange={(newValue) => {
                          const newSQT = newValue as SourceQueryType
                          setSourceQueryType(newSQT)
                          saveDetail('source', {
                            ...metricNode?.data?.source,
                            queryType: newSQT,
                          })
                        }}
                        disabled={!editingEnabled}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          {/***** Source Query *****/}
          <div className={styles.connection_config_block}>
            <div className={styles.connection_config}>
              <label
                htmlFor="source-query-field"
                className={styles.connection_config_label}
              >
                Query
              </label>
            </div>
          </div>
          <pre className={styles.detail_field_code}>
            {editingEnabled && sourceQueryType === 'freeform' ? (
              <Editor
                id="source-query-field"
                className={styles.editor}
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
              highlight(sourceQuery, 'sql')
            )}
          </pre>
        </>
      )}
    </>
  )
}

export default MetricNodeSourceFields
