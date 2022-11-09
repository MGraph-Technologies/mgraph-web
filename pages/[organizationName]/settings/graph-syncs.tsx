import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
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
import { v4 as uuidv4 } from 'uuid'

import SettingsInputText from '../../../components/SettingsInputText'
import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/GraphSyncs.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

type DbtProjectGraphSyncFormProps = {
  upsertGraphSyncId: string
  upsertGraphSyncName: string
  setUpsertGraphSyncName: Dispatch<SetStateAction<string>>
  upsertGraphSyncProperties: any
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
    process.env.NEX_PUBLIC_ENV === 'prod' ? '' : '-dev'
  }`
  const { organizationId } = useAuth()
  const [upsertGraphSyncInstalled, _setUpsertGraphSyncInstalled] = useState(
    upsertGraphSyncProperties.installationId ? true : false
  )
  const [upsertGraphSyncRepoUrl, setUpsertGraphSyncRepoUrl] = useState(
    upsertGraphSyncProperties.repoUrl || ''
  )

  useEffect(() => {
    setUpsertGraphSyncProperties((prev: any) => {
      return { ...prev, repoUrl: upsertGraphSyncRepoUrl }
    })
  }, [setUpsertGraphSyncProperties, upsertGraphSyncRepoUrl])

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
      })
    )
    const installUrl = `${appUrl}/installations/new?state=${stateId}`
    window.open(installUrl, '_self')
  }, [upsertGraphSyncName, upsertGraphSyncRepoUrl, appUrl])

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
      <div className={styles.save_cancel_button_container}>
        {upsertGraphSyncInstalled ? (
          // if app not yet installed, GitHub button is de facto the save button
          <Button
            id="save-graph-sync-button"
            label="Save"
            onClick={async () => {
              if (organizationId) {
                try {
                  let { data, error, status } = await supabase
                    .from('graph_syncs')
                    .update({
                      name: upsertGraphSyncName,
                      properties: {
                        ...upsertGraphSyncProperties,
                        repoUrl: upsertGraphSyncRepoUrl,
                      },
                      updated_at: new Date(),
                    })
                    .eq('id', upsertGraphSyncId)

                  if (error) {
                    throw error
                  }

                  if (data) {
                    analytics.track('update_graph_sync', {
                      id: upsertGraphSyncId,
                    })
                    populateGraphSyncs()
                    setShowUpsertGraphSyncPopup(false)
                    clearFields()
                  }
                } catch (error: any) {
                  console.error(error.message)
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
type GraphSyncsProps = {}
const GraphSyncs: FunctionComponent<GraphSyncsProps> = () => {
  const { organizationId } = useAuth()

  const [graphSyncsTableLoading, setGraphSyncsTableLoading] = useState(true)
  const [graphSyncs, setGraphSyncs] = useState<any[]>([])
  const populateGraphSyncs = useCallback(async () => {
    if (organizationId) {
      setGraphSyncsTableLoading(true)
      try {
        let { data, error, status } = await supabase
          .from('graph_syncs')
          .select('id, name, properties, created_at')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setGraphSyncs(data)
          setGraphSyncsTableLoading(false)
        }
      } catch (error: any) {
        console.error(error.message)
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

  const propertiesCellBodyTemplate = (rowData: any) => {
    const properties = rowData.properties
    const propertyList = Object.keys(properties).map((key) => {
      return (
        <li key={key}>
          <strong>{key}:</strong> {properties[key]}
        </li>
      )
    })
    return <ul>{propertyList}</ul>
  }

  const editCellBodyTemplate = (rowData: any) => {
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
    width: '25%',
    'word-wrap': 'break-word',
    'word-break': 'break-all',
    'white-space': 'normal',
  }

  const upsertGraphSyncTypeName = 'dbt Project' // in the future, below dropdown will vary this
  const [showUpsertGraphSyncPopup, setShowUpsertGraphSyncPopup] =
    useState(false)
  const [upsertGraphSyncId, setUpsertGraphSyncId] = useState<string>('')
  const [upsertGraphSyncName, setUpsertGraphSyncName] = useState<string>('')
  const [upsertGraphSyncProperties, setUpsertGraphSyncProperties] =
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
              onHide={() => {}} // handled by buttons, but required
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
              emptyMessage="No graph syncs found"
            >
              <Column field="name" header="Name" style={columnStyle} />
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
