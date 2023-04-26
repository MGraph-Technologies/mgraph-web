import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column, ColumnBodyType } from 'primereact/column'
import { confirmDialog } from 'primereact/confirmdialog'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import React, {
  CSSProperties,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import SettingsInputText from 'components/SettingsInputText'
import Workspace from 'components/Workspace'
import { useAuth } from 'contexts/auth'
import styles from 'styles/DatabaseConnections.module.css'
import { analytics } from 'utils/segmentClient'
import { SnowflakeCredentials } from 'utils/snowflakeCrypto'
import { supabase } from 'utils/supabaseClient'

const DatabaseConnections: FunctionComponent = () => {
  const { getValidAccessToken, organizationId } = useAuth()

  const [databaseConnectionsTableLoading, setDatabaseConnectionsTableLoading] =
    useState(true)
  type DatabaseConnection = {
    id: string
    name: string
    type_name: string
    created_at: string
  }
  const [databaseConnections, setDatabaseConnections] = useState<
    DatabaseConnection[]
  >([])
  const populateDatabaseConnections = useCallback(async () => {
    if (organizationId) {
      setDatabaseConnectionsTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('database_connections')
          .select('id, name, created_at, database_connection_types(name)')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          const _databaseConnections = data as {
            id: string
            name: string
            created_at: string
            database_connection_types: { name: string }
          }[]
          setDatabaseConnections(
            _databaseConnections.map((databaseConnection) => {
              return {
                id: databaseConnection.id,
                name: databaseConnection.name,
                type_name: databaseConnection.database_connection_types.name,
                created_at: databaseConnection.created_at,
              } as DatabaseConnection
            })
          )
          setDatabaseConnectionsTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateDatabaseConnections()
  }, [populateDatabaseConnections])

  const [databaseConnectionsTableFirst, setDatabaseConnectionsTableFirst] =
    useState(0)
  const databaseConnectionsTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'database_connections',
      page: e.page,
      first: e.first,
    })
    setDatabaseConnectionsTableFirst(e.first)
  }

  const editCellBodyTemplate: ColumnBodyType = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      const deleteDatabaseConnection = async () => {
        try {
          const { data, error } = await supabase
            .from('database_connections')
            .update({
              updated_at: new Date(),
              deleted_at: new Date(),
            })
            .eq('id', rowData.id)
            .select('id')
            .single()

          if (error) {
            throw error
          } else if (data) {
            const databaseConnection = data as { id: string }
            analytics.track('delete_database_connection', {
              id: databaseConnection.id,
            })
            populateDatabaseConnections()
          }
        } catch (error: unknown) {
          console.error(error)
        }
      }
      const confirmDelete = () => {
        confirmDialog({
          message: `Are you sure you want to delete the database connection "${rowData.name}"?`,
          icon: 'pi pi-exclamation-triangle',
          accept: deleteDatabaseConnection,
          acceptLabel: 'Delete',
          rejectLabel: 'Cancel',
          acceptClassName: 'p-button-danger',
        })
      }
      return (
        <>
          <Button
            id="edit-database-connection-button"
            className="p-button-text p-button-lg"
            icon="pi pi-pencil"
            onClick={() => {
              setUpsertDatabaseConnectionId(rowData.id)
              setUpsertDatabaseConnectionName(rowData.name)
              setUpsertDatabaseConnectionIsNew(false)
              setUpsertDatabaseConnectionPlaceholder('********')
              setShowUpsertDatabaseConnectionPopup(true)
            }}
          />
          <Button
            id="delete-database-connection-button"
            className="p-button-text p-button-lg"
            icon="pi pi-trash"
            onClick={confirmDelete}
          />
        </>
      )
    },
    [populateDatabaseConnections]
  )

  const columnStyle = {
    width: '20%',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
    wordSpace: 'normal',
  } as CSSProperties

  const upsertDatabaseConnectionTypeName = 'snowflake'
  const [
    showUpsertDatabaseConnectionPopup,
    setShowUpsertDatabaseConnectionPopup,
  ] = useState(false)
  const [upsertDatabaseConnectionId, setUpsertDatabaseConnectionId] =
    useState<string>('')
  const [upsertDatabaseConnectionName, setUpsertDatabaseConnectionName] =
    useState<string>('')
  const [upsertDatabaseConnectionRegion, setUpsertDatabaseConnectionRegion] =
    useState<string>('')
  const [upsertDatabaseConnectionAccount, setUpsertDatabaseConnectionAccount] =
    useState<string>('')
  const [
    upsertDatabaseConnectionUsername,
    setUpsertDatabaseConnectionUsername,
  ] = useState<string>('')
  const [
    upsertDatabaseConnectionPassword,
    setUpsertDatabaseConnectionPassword,
  ] = useState<string>('')
  const [
    upsertDatabaseConnectionDbtProxyServerUrl,
    setUpsertDatabaseConnectionDbtProxyServerUrl,
  ] = useState<string>('')
  const [upsertDatabaseConnectionIsNew, setUpsertDatabaseConnectionIsNew] =
    useState(true)
  const [
    upsertDatabaseConnectionPlaceholder,
    setUpsertDatabaseConnectionPlaceholder,
  ] = useState('')

  const clearFields = useCallback(() => {
    setUpsertDatabaseConnectionId('')
    setUpsertDatabaseConnectionName('')
    setUpsertDatabaseConnectionRegion('')
    setUpsertDatabaseConnectionAccount('')
    setUpsertDatabaseConnectionUsername('')
    setUpsertDatabaseConnectionPassword('')
    setUpsertDatabaseConnectionDbtProxyServerUrl('')
    setUpsertDatabaseConnectionIsNew(true)
    setUpsertDatabaseConnectionPlaceholder('')
  }, [])

  const onDialogCancel = useCallback(() => {
    setShowUpsertDatabaseConnectionPopup(false)
    clearFields()
  }, [clearFields])

  return (
    <>
      <Head>
        <title>Database Connections — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.database_connections_container}>
          <div className={styles.database_connections_title}>
            Database Connections
          </div>
          <div className={styles.new_database_connection_container}>
            <Button
              id="new-database-connection-button"
              icon="pi pi-plus"
              onClick={() => {
                setUpsertDatabaseConnectionId(uuidv4())
                setShowUpsertDatabaseConnectionPopup(true)
              }}
            />
            <Dialog
              id="new-database-connection-dialog"
              header={
                (upsertDatabaseConnectionIsNew ? 'New' : 'Edit') +
                ' Database Connection'
              }
              visible={showUpsertDatabaseConnectionPopup}
              resizable={false}
              draggable={false}
              onHide={onDialogCancel}
            >
              <b>
                <label htmlFor="database-connection-type-dropdown">
                  Type:{' '}
                </label>
              </b>
              <Dropdown
                id="database-connection-type-dropdown"
                value={upsertDatabaseConnectionTypeName}
                options={[
                  {
                    label: upsertDatabaseConnectionTypeName,
                    value: upsertDatabaseConnectionTypeName,
                  },
                ]}
                disabled // will enable when more types are supported
              />
              <br />
              <br />
              <SettingsInputText
                label="Name"
                value={upsertDatabaseConnectionName}
                setValue={setUpsertDatabaseConnectionName}
                tooltip="Help users distinguish between different database connections"
                type="text"
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <SettingsInputText
                label="Region"
                value={upsertDatabaseConnectionRegion}
                setValue={setUpsertDatabaseConnectionRegion}
                tooltip="Your Snowflake account's region (e.g. us-east4.gcp)"
                type="text"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <SettingsInputText
                label="Account"
                value={upsertDatabaseConnectionAccount}
                setValue={setUpsertDatabaseConnectionAccount}
                tooltip="Your Snowflake account's identifier (e.g. WF60137)"
                type="text"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <SettingsInputText
                label="Username"
                value={upsertDatabaseConnectionUsername}
                setValue={setUpsertDatabaseConnectionUsername}
                tooltip="The username you've created for MGraph to access Snowflake (e.g. MGRAPH)"
                type="text"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <SettingsInputText
                label="Password"
                value={upsertDatabaseConnectionPassword}
                setValue={setUpsertDatabaseConnectionPassword}
                tooltip="The password associated with the username entered above"
                type="password"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <SettingsInputText
                label="dbt Proxy Server URL"
                value={upsertDatabaseConnectionDbtProxyServerUrl}
                setValue={setUpsertDatabaseConnectionDbtProxyServerUrl}
                tooltip="(OPTIONAL) Through which to compile dbt jinja before queries' execution (e.g., https://eagle-hqya7.proxy.cloud.getdbt.com; see here for more info https://docs.getdbt.com/docs/use-dbt-semantic-layer/setup-dbt-semantic-layer)"
                type="text"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <div className={styles.save_cancel_button_container}>
                <Button
                  id="save-database-connection-button"
                  label="Save"
                  onClick={async () => {
                    const accessToken = getValidAccessToken()
                    if (organizationId && accessToken) {
                      try {
                        const {
                          data: databaseConnectionTypeData,
                          error: databaseConnectionTypeError,
                          status: databaseConnectionTypeStatus,
                        } = await supabase
                          .from('database_connection_types')
                          .select('id')
                          .eq('name', upsertDatabaseConnectionTypeName)
                          .single()

                        if (
                          databaseConnectionTypeError &&
                          databaseConnectionTypeStatus !== 406
                        ) {
                          throw databaseConnectionTypeError
                        }

                        const databaseConnectionType =
                          databaseConnectionTypeData as {
                            id: string
                          }
                        const databaseConnectionTypeId =
                          databaseConnectionType.id
                        const now = new Date()
                        let toUpsert = {
                          id: upsertDatabaseConnectionId,
                          organization_id: organizationId,
                          type_id: databaseConnectionTypeId,
                          name: upsertDatabaseConnectionName,
                          // encrypted credential to be inserted by backend
                          updated_at: now,
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        } as any
                        if (upsertDatabaseConnectionIsNew) {
                          toUpsert = {
                            ...toUpsert,
                            created_at: now,
                          }
                        }

                        const credentials =
                          upsertDatabaseConnectionRegion ||
                          upsertDatabaseConnectionAccount ||
                          upsertDatabaseConnectionUsername ||
                          upsertDatabaseConnectionPassword ||
                          upsertDatabaseConnectionDbtProxyServerUrl
                            ? ({
                                region: upsertDatabaseConnectionRegion,
                                account: upsertDatabaseConnectionAccount,
                                username: upsertDatabaseConnectionUsername,
                                password: upsertDatabaseConnectionPassword,
                                dbtProxyServerUrl:
                                  upsertDatabaseConnectionDbtProxyServerUrl,
                              } as SnowflakeCredentials)
                            : null

                        const resp = await fetch(
                          '/api/v1/database-connections',
                          {
                            method: 'POST',
                            headers: {
                              'supabase-access-token': accessToken,
                            },
                            body: JSON.stringify({
                              toUpsert: toUpsert,
                              credentials: credentials,
                            }),
                          }
                        )
                        if (resp.status === 200) {
                          analytics.track(
                            upsertDatabaseConnectionIsNew
                              ? 'create_database_connection'
                              : 'update_database_connection',
                            {
                              id: upsertDatabaseConnectionId,
                            }
                          )
                          populateDatabaseConnections()
                          setShowUpsertDatabaseConnectionPopup(false)
                          clearFields()
                        } else {
                          throw new Error(
                            'Error creating/updating database connection'
                          )
                        }
                      } catch (error: unknown) {
                        console.error(error)
                      }
                    }
                  }}
                />
                <div className={styles.save_cancel_button_spacer} />
                <Button
                  id="cancel-database-connection-button"
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={onDialogCancel}
                />
              </div>
            </Dialog>
          </div>
          <div className={styles.database_connections_table_container}>
            <DataTable
              paginator
              scrollable
              id="database-connections-table"
              className="p-datatable-database_connections"
              value={databaseConnections}
              loading={databaseConnectionsTableLoading}
              scrollHeight="flex"
              rows={10}
              paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
              currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
              first={databaseConnectionsTableFirst}
              onPage={databaseConnectionsTableOnPage}
              emptyMessage="No database connections configured"
            >
              <Column field="name" header="Name" style={columnStyle} />
              <Column field="type_name" header="Type" style={columnStyle} />
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

export default DatabaseConnections
