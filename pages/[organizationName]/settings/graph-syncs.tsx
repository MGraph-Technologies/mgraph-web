import endent from 'endent'
import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column, ColumnBodyType } from 'primereact/column'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import React, {
  Dispatch,
  FunctionComponent,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react'
import Editor from 'react-simple-code-editor'
import { v4 as uuidv4 } from 'uuid'

import SettingsInputText from '../../../components/SettingsInputText'
import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'
import styles from '../../../styles/GraphSyncs.module.css'
import { highlight } from '../../../utils/codeHighlighter'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

type DbtProjectGraphSyncFormProps = {
  upsertGraphSyncId: string
  upsertGraphSyncName: string
  setUpsertGraphSyncName: Dispatch<SetStateAction<string>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertGraphSyncProperties: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setUpsertGraphSyncProperties: Dispatch<SetStateAction<any>>
  setShowUpsertGraphSyncPopup: Dispatch<SetStateAction<boolean>>
  populateGraphSyncs: () => void
  clearFields: () => void
}
const DbtProjectGraphSyncForm: FunctionComponent<
  DbtProjectGraphSyncFormProps
> = ({
  upsertGraphSyncId,
  upsertGraphSyncName,
  setUpsertGraphSyncName,
  upsertGraphSyncProperties,
  setUpsertGraphSyncProperties,
  setShowUpsertGraphSyncPopup,
  populateGraphSyncs,
  clearFields,
}) => {
  const appUrl = `https://github.com/apps/mgraph-dbt-sync${
    process.env.NEXT_PUBLIC_ENV === 'production' ? '' : '-dev'
  }`
  const { organizationId } = useAuth()
  const { editingEnabled } = useEditability()
  const { graph, loadGraph } = useGraph()
  const [upsertGraphSyncInstalled] = useState(
    upsertGraphSyncProperties.installationId ? true : false
  )
  const [upsertGraphSyncRepoUrl, setUpsertGraphSyncRepoUrl] = useState(
    upsertGraphSyncProperties.repoUrl || ''
  )
  const [
    upsertGraphSyncGeneratedQueryTemplate,
    setUpsertGraphSyncGeneratedQueryTemplate,
  ] = useState<string>(
    !upsertGraphSyncProperties.installationId
      ? // if new sync, use default template
        endent`
          -- mgraph params below are replaced prior to dbt compilation
          SELECT
            -- dbt grains always lowercase
            date_{{ "{{frequency}}".lower() }} AS date,
            -- allow empty group_by param
            {{ "{{group_by}}" if "{{group_by}}" else "CAST(NULL AS STRING)" }} AS dimension,
            IFF(
              date_{{ "{{frequency}}".lower() }} < DATE_TRUNC({{frequency}}, SYSDATE())
                OR {{show_unfinished_values}},
              {{metric_name}},
              NULL
            ) as value
          FROM
            {{
              metrics.calculate(
                metric("{{metric_name}}"),
                grain="{{frequency}}".lower(),
                dimensions=["{{group_by}}"] if "{{group_by}}" else [],
                where="{{conditions}}"
              )
            }}
          WHERE
            -- allow absolute (e.g., '2022-01-01-') and relative (e.g., SYSDATE() - INTERVAL '30 DAY') params
            date_{{ "{{frequency}}".lower() }} BETWEEN {{beginning_date}} AND {{ending_date}}
        `
      : // otherwise use whatever's in the db
        upsertGraphSyncProperties.generatedQueryTemplate || ''
  )

  // keep properties in sync with form fields
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUpsertGraphSyncProperties((prev: any) => {
      return { ...prev, repoUrl: upsertGraphSyncRepoUrl }
    })
  }, [setUpsertGraphSyncProperties, upsertGraphSyncRepoUrl])
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUpsertGraphSyncProperties((prev: any) => {
      return {
        ...prev,
        generatedQueryTemplate: upsertGraphSyncGeneratedQueryTemplate,
      }
    })
  }, [setUpsertGraphSyncProperties, upsertGraphSyncGeneratedQueryTemplate])

  const onInstallGitHubAppClick = useCallback(() => {
    /* use localStorage and state param so that callback
      can be verified and persist name / repoUrl to pg,
      which must be done by client since state isn't included
      in github webhook payload */
    const stateId = uuidv4()
    localStorage.setItem(
      `githubAppInstallState${stateId}`,
      JSON.stringify({
        name: upsertGraphSyncName,
        repoUrl: upsertGraphSyncRepoUrl,
        generatedQueryTemplate: upsertGraphSyncGeneratedQueryTemplate,
      })
    )
    const installUrl = `${appUrl}/installations/new?state=${stateId}`
    window.open(installUrl, '_self')
  }, [
    upsertGraphSyncName,
    upsertGraphSyncRepoUrl,
    upsertGraphSyncGeneratedQueryTemplate,
    appUrl,
  ])

  return (
    <>
      <p style={{ fontStyle: 'italic' }}>
        Sync metrics between MGraph and a dbt project.
      </p>
      <SettingsInputText
        label="Name"
        value={upsertGraphSyncName}
        setValue={setUpsertGraphSyncName}
        type="text"
        tooltip="Help users distinguish between different graph syncs"
      />
      <SettingsInputText
        label="GitHub Repo URL"
        value={upsertGraphSyncRepoUrl}
        setValue={setUpsertGraphSyncRepoUrl}
        type="text"
        tooltip="The GitHub repo of the dbt project to sync"
      />
      <label
        htmlFor="github-app-button"
        style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}
      >
        GitHub App:
      </label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {upsertGraphSyncInstalled ? (
          <Button
            id="github-app-button"
            className="p-button-outlined"
            label="Configure / Uninstall"
            icon="pi pi-github"
            onClick={() => {
              window.open(appUrl, '_self')
            }}
            style={{ display: 'block' }}
          />
        ) : (
          <Button
            id="github-app-button"
            label="Install"
            icon="pi pi-github"
            onClick={onInstallGitHubAppClick}
            style={{ display: 'block' }}
          />
        )}
        <Button
          className="p-button-text"
          icon="pi pi-info-circle"
          tooltip="The MGraph dbt Sync GitHub app must have access to the above repo to sync metrics."
        />
      </div>
      <br />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <label
          htmlFor="query-template-editor"
          style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}
        >
          Generated Query Template
        </label>
        <Button
          className="p-button-text"
          icon="pi pi-info-circle"
          tooltip="Template used for query generation for synced metrics."
        />
      </div>
      <Editor
        id="query-template-editor"
        value={upsertGraphSyncGeneratedQueryTemplate}
        onValueChange={(query) =>
          setUpsertGraphSyncGeneratedQueryTemplate(query)
        }
        highlight={(query) => highlight(query, 'sql')}
        textareaClassName="react-simple-code-editor-textarea"
      />
      <br />
      <div className={styles.save_cancel_button_container}>
        {upsertGraphSyncInstalled ? (
          // if app not yet installed, GitHub button is de facto the save button
          <Button
            id="save-graph-sync-button"
            label="Save"
            onClick={async () => {
              if (editingEnabled) {
                alert('Cannot save graph sync while editing is enabled.')
                // since loadGraph() below would discard pending changes
                return
              }
              if (organizationId && loadGraph) {
                try {
                  // update dependent nodes
                  // TODO: should prob move this to backend
                  graph.nodes.forEach(async (node) => {
                    if (
                      node.type === 'metric' &&
                      node.data.source?.queryType === 'generated' &&
                      node.data.source?.dbtProjectGraphSyncId ===
                        upsertGraphSyncId
                    ) {
                      const metricPath = node.data.source.dbtProjectMetricPath
                      const metricId = metricPath
                        ? metricPath.split(':').pop()
                        : ''
                      const newQuery =
                        upsertGraphSyncGeneratedQueryTemplate.replace(
                          /{{\s*metric_name\s*}}/g,
                          metricId
                        )
                      const newProperties = {
                        ...node.data.initialProperties,
                      }
                      newProperties.source.query = newQuery
                      const { error: updateNodeError } = await supabase
                        .from('nodes')
                        .update({
                          properties: newProperties,
                        })
                        .eq('id', node.id)

                      if (updateNodeError) {
                        throw updateNodeError
                      }
                    }
                  })

                  // update graph sync record
                  const {
                    data: updateGraphSyncData,
                    error: updateGraphSyncError,
                  } = await supabase
                    .from('graph_syncs')
                    .update({
                      name: upsertGraphSyncName,
                      properties: {
                        ...upsertGraphSyncProperties,
                      },
                      updated_at: new Date(),
                    })
                    .eq('id', upsertGraphSyncId)

                  if (updateGraphSyncError) {
                    throw updateGraphSyncError
                  }

                  if (updateGraphSyncData) {
                    analytics.track('update_graph_sync', {
                      id: upsertGraphSyncId,
                    })
                    loadGraph()
                    populateGraphSyncs()
                    setShowUpsertGraphSyncPopup(false)
                    clearFields()
                  }
                } catch (error: unknown) {
                  console.error(error)
                }
              }
            }}
          />
        ) : null}
        <div className={styles.save_cancel_button_spacer} />
        <Button
          id="cancel-graph-sync-button"
          className="p-button-outlined"
          label="Cancel"
          onClick={() => {
            setShowUpsertGraphSyncPopup(false)
            clearFields()
          }}
        />
      </div>
    </>
  )
}

// TODO: better componentize this + database-connections + refresh-jobs
const GraphSyncs: FunctionComponent = () => {
  const { organizationId } = useAuth()

  const [graphSyncsTableLoading, setGraphSyncsTableLoading] = useState(true)
  type GraphSync = {
    id: string
    name: string
    type_name: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    properties: any
    created_at: string
  }
  const [graphSyncs, setGraphSyncs] = useState<GraphSync[]>([])
  const populateGraphSyncs = useCallback(async () => {
    if (organizationId) {
      setGraphSyncsTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('graph_syncs')
          .select('id, name, properties, created_at, graph_sync_types(name)')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          const _graphSyncs = data.map((graphSync) => {
            return {
              id: graphSync.id,
              name: graphSync.name,
              type_name: graphSync.graph_sync_types.name,
              properties: graphSync.properties,
              created_at: graphSync.created_at,
            } as GraphSync
          })
          setGraphSyncs(_graphSyncs)
          setGraphSyncsTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateGraphSyncs()
  }, [populateGraphSyncs])

  const [graphSyncsTableFirst, setGraphSyncsTableFirst] = useState(0)
  const graphSyncsTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'graph_syncs',
      page: e.page,
      first: e.first,
    })
    setGraphSyncsTableFirst(e.first)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertiesCellBodyTemplate: ColumnBodyType = (rowData: any) => {
    const properties = rowData.properties
    const propertyList = Object.keys(properties).map((key) => {
      const value = properties[key]
      let valueStr = typeof value === 'string' ? value : JSON.stringify(value)
      if (valueStr.length > 50) {
        valueStr = `${valueStr.substring(0, 50)}...`
      }
      return (
        <li key={key}>
          <strong>{key}:</strong> {valueStr}
        </li>
      )
    })
    return <ul>{propertyList}</ul>
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editCellBodyTemplate: ColumnBodyType = (rowData: any) => {
    return (
      <>
        <Button
          id="edit-graph-sync-button"
          className="p-button-text p-button-lg"
          icon="pi pi-pencil"
          onClick={() => {
            setUpsertGraphSyncId(rowData.id)
            setUpsertGraphSyncName(rowData.name)
            setUpsertGraphSyncProperties(rowData.properties)
            setUpsertGraphSyncIsNew(false)
            setShowUpsertGraphSyncPopup(true)
          }}
        />
        <Button
          id="delete-graph-sync-button"
          className="p-button-text p-button-lg"
          icon="pi pi-trash"
          tooltip="To delete this sync, uninstall the corresponding GitHub App via the Edit button at left."
        />
      </>
    )
  }

  const columnStyle = {
    width: '20%',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
    wordSpace: 'normal',
  }

  const upsertGraphSyncTypeName = 'dbt Project' // in the future, below dropdown will vary this
  const [showUpsertGraphSyncPopup, setShowUpsertGraphSyncPopup] =
    useState(false)
  const [upsertGraphSyncId, setUpsertGraphSyncId] = useState<string>('')
  const [upsertGraphSyncName, setUpsertGraphSyncName] = useState<string>('')
  const [upsertGraphSyncProperties, setUpsertGraphSyncProperties] =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useState<any>({})
  const [upsertGraphSyncIsNew, setUpsertGraphSyncIsNew] = useState(true)

  const clearFields = useCallback(() => {
    setUpsertGraphSyncId('')
    setUpsertGraphSyncName('')
    setUpsertGraphSyncProperties({})
    setUpsertGraphSyncIsNew(true)
  }, [])

  return (
    <>
      <Head>
        <title>Graph Syncs — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.graph_syncs_container}>
          <div className={styles.graph_syncs_title}>Graph Syncs</div>
          <div className={styles.new_graph_sync_container}>
            <Button
              id="new-graph-sync-button"
              icon="pi pi-plus"
              onClick={() => {
                setUpsertGraphSyncId(uuidv4())
                setShowUpsertGraphSyncPopup(true)
              }}
            />
            <Dialog
              id="new-graph-sync-dialog"
              header={(upsertGraphSyncIsNew ? 'New' : 'Edit') + ' Graph Sync'}
              visible={showUpsertGraphSyncPopup}
              resizable={false}
              draggable={false}
              closable={false} // use cancel button instead
              onHide={() => {
                return
              }} // handled by buttons, but required
            >
              <b>
                <label htmlFor="graph-sync-type-dropdown">Type: </label>
              </b>
              <Dropdown
                id="graph-sync-type-dropdown"
                value={upsertGraphSyncTypeName}
                options={[
                  {
                    label: upsertGraphSyncTypeName,
                    value: upsertGraphSyncTypeName,
                  },
                ]}
                disabled // will enable when more types are supported
              />
              {upsertGraphSyncTypeName === 'dbt Project' && (
                <DbtProjectGraphSyncForm
                  upsertGraphSyncId={upsertGraphSyncId}
                  upsertGraphSyncName={upsertGraphSyncName}
                  setUpsertGraphSyncName={setUpsertGraphSyncName}
                  upsertGraphSyncProperties={upsertGraphSyncProperties}
                  setUpsertGraphSyncProperties={setUpsertGraphSyncProperties}
                  setShowUpsertGraphSyncPopup={setShowUpsertGraphSyncPopup}
                  populateGraphSyncs={populateGraphSyncs}
                  clearFields={clearFields}
                />
              )}
              {/* subsequent types TBA */}
            </Dialog>
          </div>
          <div className={styles.graph_syncs_table_container}>
            <DataTable
              paginator
              scrollable
              id="graph-syncs-table"
              className="p-datatable-graph_syncs"
              value={graphSyncs}
              loading={graphSyncsTableLoading}
              scrollHeight="flex"
              rows={10}
              paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
              currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
              first={graphSyncsTableFirst}
              onPage={graphSyncsTableOnPage}
              filterDisplay="row"
              emptyMessage="No graph syncs configured"
            >
              <Column field="name" header="Name" style={columnStyle} />
              <Column field="type_name" header="Type" style={columnStyle} />
              <Column
                field="properties"
                header="Properties"
                body={propertiesCellBodyTemplate}
                style={columnStyle}
              />
              <Column
                field="created_at"
                header="Created At"
                style={columnStyle}
              />
              <Column body={editCellBodyTemplate} align="center" />
            </DataTable>
          </div>
        </div>
      </Workspace>
    </>
  )
}

export default GraphSyncs
