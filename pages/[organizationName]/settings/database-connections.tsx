import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import SettingsInputText from '../../../components/SettingsInputText'
import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/DatabaseConnections.module.css'
import { analytics } from '../../../utils/segmentClient'
import { SnowflakeCredentials } from '../../../utils/snowflakeCrypto'
import { supabase } from '../../../utils/supabaseClient'

type DatabaseConnectionsProps = {}
const DatabaseConnections: FunctionComponent<DatabaseConnectionsProps> = () => {
  const { organizationId, session } = useAuth()

  const [databaseConnectionsTableLoading, setDatabaseConnectionsTableLoading] =
    useState(true)
  const [databaseConnections, setDatabaseConnections] = useState<any[]>([])
  const populateDatabaseConnections = useCallback(async () => {
    if (organizationId) {
      setDatabaseConnectionsTableLoading(true)
      try {
        let { data, error, status } = await supabase
          .from('database_connections')
          .select('id, name, created_at')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setDatabaseConnections(data)
          setDatabaseConnectionsTableLoading(false)
        }
      } catch (error: any) {
        console.error(error.message)
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

  const editCellBodyTemplate = useCallback(
    (rowData: any) => {
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
            onClick={async () => {
              try {
                let { data, error, status } = await supabase
                  .from('database_connections')
                  .update({ deleted_at: new Date() })
                  .eq('id', rowData.id)

                if (error) {
                  throw error
                } else if (data) {
                  analytics.track('delete_database_connection', {
                    id: rowData.id,
                  })
                  populateDatabaseConnections()
                }
              } catch (error: any) {
                console.error(error.message)
              }
            }}
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
  }

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
    upsertDatabaseConnectionPrivateKey,
    setUpsertDatabaseConnectionPrivateKey,
  ] = useState<string>('')
  const [
    upsertDatabaseConnectionPrivateKeyPassphrase,
    setUpsertDatabaseConnectionPrivateKeyPassphrase,
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
    setUpsertDatabaseConnectionPrivateKey('')
    setUpsertDatabaseConnectionPrivateKeyPassphrase('')
    setUpsertDatabaseConnectionIsNew(true)
    setUpsertDatabaseConnectionPlaceholder('')
  }, [])

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
              closable={false} // use cancel button instead
              onHide={() => {}} // handled by buttons, but required
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
                label="Private Key"
                value={upsertDatabaseConnectionPrivateKey}
                setValue={setUpsertDatabaseConnectionPrivateKey}
                tooltip="An encrypted private key configured for the username entered above, with newlines replaced by \n characters; see https://docs.snowflake.com/en/user-guide/key-pair-auth.html"
                type="password"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <SettingsInputText
                label="Private Key Passphrase"
                value={upsertDatabaseConnectionPrivateKeyPassphrase}
                setValue={setUpsertDatabaseConnectionPrivateKeyPassphrase}
                tooltip="The passphrase for the private key entered above"
                type="password"
                placeholder={upsertDatabaseConnectionPlaceholder}
                onClick={() => setUpsertDatabaseConnectionPlaceholder('')}
              />
              <div className={styles.save_cancel_button_container}>
                <Button
                  id="save-database-connection-button"
                  label="Save"
                  onClick={async () => {
                    const accessToken = session?.access_token
                    if (organizationId && accessToken) {
                      try {
                        let {
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

                        const databaseConnectionTypeId =
                          databaseConnectionTypeData?.id
                        const now = new Date()
                        let toUpsert = {
                          id: upsertDatabaseConnectionId,
                          organization_id: organizationId,
                          type_id: databaseConnectionTypeId,
                          name: upsertDatabaseConnectionName,
                          // encrypted credential to be inserted by backend
                          updated_at: now,
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
                          upsertDatabaseConnectionPrivateKey ||
                          upsertDatabaseConnectionPrivateKeyPassphrase
                            ? ({
                                region: upsertDatabaseConnectionRegion,
                                account: upsertDatabaseConnectionAccount,
                                username: upsertDatabaseConnectionUsername,
                                privateKeyString:
                                  upsertDatabaseConnectionPrivateKey.replaceAll(
                                    '\\n',
                                    '\n'
                                  ),
                                privateKeyPassphrase:
                                  upsertDatabaseConnectionPrivateKeyPassphrase,
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
                      } catch (error: any) {
                        console.error(error.message)
                      }
                    }
                  }}
                />
                <div className={styles.save_cancel_button_spacer} />
                <Button
                  id="cancel-database-connection-button"
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={() => {
                    setShowUpsertDatabaseConnectionPopup(false)
                    clearFields()
                  }}
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
              filterDisplay="row"
              emptyMessage="No database connections found"
            >
              <Column field="name" header="Name" style={columnStyle} />
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
