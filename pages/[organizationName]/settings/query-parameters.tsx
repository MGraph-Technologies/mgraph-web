import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column, ColumnBodyType } from 'primereact/column'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import React, {
  CSSProperties,
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'
import SectionHeader from '../../../components/SectionHeader'

import SettingsInputText from '../../../components/SettingsInputText'
import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/QueryParameters.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

const QueryParameters: FunctionComponent = () => {
  const { organizationId } = useAuth()

  const [dimensionsTableLoading, setDimensionsTableLoading] = useState(true)
  type Dimension = {
    id: string
    name: string
    value: string
    createdAt: string
  }
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const populateDimensions = useCallback(async () => {
    if (organizationId) {
      setDimensionsTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('database_query_dimensions')
          .select('id, name, value, created_at')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setDimensions(
            data.map(
              (qp) =>
                ({
                  id: qp.id,
                  name: qp.name,
                  value: qp.value,
                  createdAt: qp.created_at,
                } as Dimension)
            )
          )
          setDimensionsTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateDimensions()
  }, [populateDimensions])

  const [dimensionsTableFirst, setDimensionsTableFirst] = useState(0)
  const dimensionsTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'query_dimensions',
      page: e.page,
      first: e.first,
    })
    setDimensionsTableFirst(e.first)
  }

  const editCellBodyTemplate: ColumnBodyType = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      const deleteDimension = async () => {
        try {
          const { data, error } = await supabase
            .from('database_query_dimensions')
            .update({ deleted_at: new Date() })
            .eq('id', rowData.id)

          if (error) {
            throw error
          } else if (data) {
            analytics.track('delete_query_dimension', {
              id: rowData.id,
            })
            populateDimensions()
          }
        } catch (error: unknown) {
          console.error(error)
        }
      }
      const confirmDelete = () => {
        confirmDialog({
          message: `Are you sure you want to delete the dimension "${rowData.name}"?`,
          icon: 'pi pi-exclamation-triangle',
          accept: deleteDimension,
          acceptLabel: 'Delete',
          rejectLabel: 'Cancel',
          acceptClassName: 'p-button-danger',
        })
      }
      return (
        <>
          <Button
            id="edit-dimension-button"
            className="p-button-text p-button-lg"
            icon="pi pi-pencil"
            onClick={() => {
              setUpsertJobId(rowData.id)
              setUpsertJobName(rowData.name)
              setUpsertJobValue(rowData.value)
              setUpsertJobIsNew(false)
              setShowUpsertJobPopup(true)
            }}
          />
          <Button
            id="delete-dimension-button"
            className="p-button-text p-button-lg"
            icon="pi pi-trash"
            onClick={confirmDelete}
          />
        </>
      )
    },
    [populateDimensions]
  )

  const columnStyle = {
    width: '20%',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
    wordSpace: 'normal',
  } as CSSProperties

  const [showUpsertJobPopup, setShowUpsertJobPopup] = useState(false)
  const [upsertJobId, setUpsertJobId] = useState<string>('')
  const [upsertJobName, setUpsertJobName] = useState<string>('')
  const [upsertJobValue, setUpsertJobValue] = useState<string>('')
  const [upsertJobIsNew, setUpsertJobIsNew] = useState(true)

  const clearFields = useCallback(() => {
    setUpsertJobId('')
    setUpsertJobName('')
    setUpsertJobValue('')
    setUpsertJobIsNew(true)
  }, [])

  return (
    <>
      <Head>
        <title>Query Parameters — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.query_parameters_container}>
          <div className={styles.query_parameters_title}>Query Parameters</div>
          <SectionHeader title="Dimensions" size="h2" />
          <div className={styles.new_dimension_container}>
            <Button
              id="new-dimension-button"
              icon="pi pi-plus"
              onClick={() => {
                setUpsertJobId(uuidv4())
                setShowUpsertJobPopup(true)
              }}
            />
            <Dialog
              id="new-dimension-dialog"
              header={(upsertJobIsNew ? 'New' : 'Edit') + ' Dimension'}
              visible={showUpsertJobPopup}
              resizable={false}
              draggable={false}
              closable={false} // use cancel button instead
              onHide={() => {
                return
              }} // handled by buttons, but required
            >
              <SettingsInputText
                label="Name"
                value={upsertJobName}
                setValue={setUpsertJobName}
                tooltip="Displayed in Query Parameters dropdown in MGraph"
              />
              <SettingsInputText
                label="Value"
                value={upsertJobValue}
                setValue={setUpsertJobValue}
                tooltip="Inserted into queries when selected in MGraph"
              />
              <div className={styles.save_cancel_button_container}>
                <Button
                  id="save-dimension-button"
                  label="Save"
                  onClick={async () => {
                    if (organizationId) {
                      const now = new Date()
                      let toUpsert = {
                        id: upsertJobId,
                        name: upsertJobName,
                        organization_id: organizationId,
                        value: upsertJobValue,
                        updated_at: now,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      } as any
                      if (upsertJobIsNew) {
                        toUpsert = {
                          ...toUpsert,
                          created_at: now,
                        }
                      }
                      try {
                        const { data, error } = await supabase
                          .from('database_query_dimensions')
                          .upsert([toUpsert])
                          .select()

                        if (error) {
                          throw error
                        }

                        if (data) {
                          analytics.track(
                            upsertJobIsNew
                              ? 'create_query_dimension'
                              : 'update_query_dimension',
                            {
                              id: data[0].id,
                            }
                          )
                          populateDimensions()
                          setShowUpsertJobPopup(false)
                          clearFields()
                        }
                      } catch (error: unknown) {
                        console.error(error)
                      }
                    }
                  }}
                />
                <div className={styles.save_cancel_button_spacer} />
                <Button
                  id="cancel-dimension-button"
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={() => {
                    setShowUpsertJobPopup(false)
                    clearFields()
                  }}
                />
              </div>
            </Dialog>
          </div>
          <div className={styles.dimensions_table_container}>
            <DataTable
              paginator
              scrollable
              id="dimensions-table"
              className="p-datatable-dimensions"
              value={dimensions}
              loading={dimensionsTableLoading}
              scrollHeight="flex"
              rows={10}
              paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
              currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
              first={dimensionsTableFirst}
              onPage={dimensionsTableOnPage}
              filterDisplay="row"
              emptyMessage="No dimensions configured"
            >
              <Column field="name" header="Name" style={columnStyle} />
              <Column field="value" header="Value" style={columnStyle} />
              <Column
                field="createdAt"
                header="Created At"
                style={columnStyle}
              />
              <Column body={editCellBodyTemplate} align="center" />
            </DataTable>
            <ConfirmDialog />
          </div>
        </div>
      </Workspace>
    </>
  )
}

export default QueryParameters
