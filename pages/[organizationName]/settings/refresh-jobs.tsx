import { isValidCron } from 'cron-validator'
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

import SettingsInputText from 'components/SettingsInputText'
import Workspace from 'components/Workspace'
import { useAuth } from 'contexts/auth'
import styles from 'styles/RefreshJobs.module.css'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

const RefreshJobs: FunctionComponent = () => {
  const { organizationId } = useAuth()

  const [refreshJobsTableLoading, setRefreshJobsTableLoading] = useState(true)
  type RefreshJob = {
    id: string
    name: string
    schedule: string
    slackTo: string
    createdAt: string
  }
  const [refreshJobs, setRefreshJobs] = useState<RefreshJob[]>([])
  const populateRefreshJobs = useCallback(async () => {
    if (organizationId) {
      setRefreshJobsTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('refresh_jobs')
          .select('id, name, schedule, slack_to, created_at')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setRefreshJobs(
            data.map(
              (rj) =>
                ({
                  id: rj.id,
                  name: rj.name,
                  schedule: rj.schedule,
                  slackTo: rj.slack_to,
                  createdAt: rj.created_at,
                } as RefreshJob)
            )
          )
          setRefreshJobsTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateRefreshJobs()
  }, [populateRefreshJobs])

  const [refreshJobsTableFirst, setRefreshJobsTableFirst] = useState(0)
  const refreshJobsTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'refresh_jobs',
      page: e.page,
      first: e.first,
    })
    setRefreshJobsTableFirst(e.first)
  }

  const editCellBodyTemplate: ColumnBodyType = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      const deleteRefreshJob = async () => {
        try {
          const { data, error } = await supabase
            .from('refresh_jobs')
            .update({ deleted_at: new Date() })
            .eq('id', rowData.id)
            .select('id')

          if (error) {
            throw error
          } else if (data) {
            analytics.track('delete_refresh_job', {
              id: rowData.id,
            })
            populateRefreshJobs()
          }
        } catch (error: unknown) {
          console.error(error)
        }
      }
      const confirmDelete = () => {
        confirmDialog({
          message: `Are you sure you want to delete the refresh job "${rowData.name}"?`,
          icon: 'pi pi-exclamation-triangle',
          accept: deleteRefreshJob,
          acceptLabel: 'Delete',
          rejectLabel: 'Cancel',
          acceptClassName: 'p-button-danger',
        })
      }
      return (
        <>
          <Button
            id="edit-refresh-job-button"
            className="p-button-text p-button-lg"
            icon="pi pi-pencil"
            onClick={() => {
              setUpsertJobId(rowData.id)
              setUpsertJobName(rowData.name)
              setUpsertJobSchedule(rowData.schedule)
              setUpsertJobSlackTo(rowData.slackTo)
              setUpsertJobIsNew(false)
              setShowUpsertJobPopup(true)
            }}
          />
          <Button
            id="delete-refresh-job-button"
            className="p-button-text p-button-lg"
            icon="pi pi-trash"
            onClick={confirmDelete}
          />
        </>
      )
    },
    [populateRefreshJobs]
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
  const [upsertJobSchedule, setUpsertJobSchedule] = useState<string>('')
  const [upsertJobSlackTo, setUpsertJobSlackTo] = useState<string>('')
  const [upsertJobIsNew, setUpsertJobIsNew] = useState(true)

  const clearFields = useCallback(() => {
    setUpsertJobId('')
    setUpsertJobName('')
    setUpsertJobSchedule('')
    setUpsertJobSlackTo('')
    setUpsertJobIsNew(true)
  }, [])

  const onDialogCancel = useCallback(() => {
    setShowUpsertJobPopup(false)
    clearFields()
  }, [clearFields])

  return (
    <>
      <Head>
        <title>Refresh Jobs — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.refresh_jobs_container}>
          <div className={styles.refresh_jobs_title}>Refresh Jobs</div>
          <div className={styles.new_refresh_job_container}>
            <Button
              id="new-refresh-job-button"
              icon="pi pi-plus"
              onClick={() => {
                setUpsertJobId(uuidv4())
                setShowUpsertJobPopup(true)
              }}
            />
            <Dialog
              id="new-refresh-job-dialog"
              header={(upsertJobIsNew ? 'New' : 'Edit') + ' Refresh Job'}
              visible={showUpsertJobPopup}
              resizable={false}
              draggable={false}
              onHide={onDialogCancel}
            >
              <SettingsInputText
                label="Name"
                value={upsertJobName}
                setValue={setUpsertJobName}
                tooltip="(optional) A brief description of the refresh job"
              />
              <SettingsInputText
                label="Schedule"
                value={upsertJobSchedule}
                setValue={setUpsertJobSchedule}
                tooltip="A cron expression in UTC time; max every-minute frequency"
              />
              <SettingsInputText
                label="Slack To"
                value={upsertJobSlackTo}
                setValue={setUpsertJobSlackTo}
                tooltip="(optional) Slack webhook urls to be notified upon refresh job completion, comma separated"
              />
              <div className={styles.save_cancel_button_container}>
                <Button
                  id="save-refresh-job-button"
                  label="Save"
                  onClick={async () => {
                    if (!isValidCron(upsertJobSchedule)) {
                      alert('Schedule must be a valid cron expression')
                      return
                    }

                    if (organizationId) {
                      const now = new Date()
                      let toUpsert = {
                        id: upsertJobId,
                        name: upsertJobName,
                        organization_id: organizationId,
                        schedule: upsertJobSchedule,
                        slack_to: upsertJobSlackTo,
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
                          .from('refresh_jobs')
                          .upsert([toUpsert])
                          .select('id')
                          .single()

                        if (error) {
                          throw error
                        }

                        if (data) {
                          analytics.track(
                            upsertJobIsNew
                              ? 'create_refresh_job'
                              : 'update_refresh_job',
                            {
                              id: data.id,
                            }
                          )
                          populateRefreshJobs()
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
                  id="cancel-refresh-job-button"
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={onDialogCancel}
                />
              </div>
            </Dialog>
          </div>
          <div className={styles.refresh_jobs_table_container}>
            <DataTable
              paginator
              scrollable
              id="refresh-jobs-table"
              className="p-datatable-refresh_jobs"
              value={refreshJobs}
              loading={refreshJobsTableLoading}
              scrollHeight="flex"
              rows={10}
              paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
              currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
              first={refreshJobsTableFirst}
              onPage={refreshJobsTableOnPage}
              emptyMessage="No refresh jobs configured"
            >
              <Column field="name" header="Name" style={columnStyle} />
              <Column field="schedule" header="Schedule" style={columnStyle} />
              <Column field="slackTo" header="Slack To" style={columnStyle} />
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

export default RefreshJobs
