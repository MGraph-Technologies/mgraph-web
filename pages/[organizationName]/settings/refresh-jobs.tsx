import { EditText } from 'react-edit-text'
import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/RefreshJobs.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

type RefreshJobsProps = {}
const RefreshJobs: FunctionComponent<RefreshJobsProps> = () => {
  const { organizationId } = useAuth()

  const [showUpsertJobPopup, setShowUpsertJobPopup] = useState(false)
  const [upsertJobId, setUpsertJobId] = useState<string>('')
  const [upsertJobSchedule, setUpsertJobSchedule] = useState<string>('')
  const [upsertJobSlackTo, setUpsertJobSlackTo] = useState<string>('')
  const [upsertJobComment, setUpsertJobComment] = useState<string>('')
  const [upsertJobIsNew, setUpsertJobIsNew] = useState(true)

  const clearFields = useCallback(() => {
    setUpsertJobId('')
    setUpsertJobSchedule('')
    setUpsertJobSlackTo('')
    setUpsertJobComment('')
    setUpsertJobIsNew(true)
  }, [])

  type NewRefreshJobFieldProps = {
    label: string
    value: string
    setValue: (value: string) => void
    tooltip?: string
  }
  const NewRefreshJobField: FunctionComponent<NewRefreshJobFieldProps> =
    useCallback(({ label, value, setValue, tooltip }) => {
      const id =
        'new-job-' + label.toLowerCase().replaceAll(' ', '-') + '-field'
      return (
        <div className={styles.new_refresh_job_field_container}>
          <div>
            <b>
              <label htmlFor={id}>{label}</label>
            </b>
            <EditText
              id={id}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
              }}
              style={{ width: '200px', border: '1px solid #ccc' }}
            />
          </div>
          <Button
            className="p-button-text p-button-sm"
            icon="pi pi-info-circle"
            tooltip={tooltip}
            tooltipOptions={{
              position: 'left',
              style: { width: '500px' },
            }}
          />
        </div>
      )
    }, [])

  const [refreshJobsTableLoading, setRefreshJobsTableLoading] = useState(true)
  const [refreshJobs, setRefreshJobs] = useState<any[]>([])
  const populateRefreshJobs = useCallback(async () => {
    if (organizationId) {
      setRefreshJobsTableLoading(true)
      try {
        let { data, error, status } = await supabase
          .from('refresh_jobs')
          .select('id, schedule, slack_to, comment, created_at')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setRefreshJobs(data)
          setRefreshJobsTableLoading(false)
        }
      } catch (error: any) {
        console.error(error.message)
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

  const editCellBodyTemplate = useCallback(
    (rowData: any) => {
      return (
        <>
          <Button
            id="edit-refresh-job-button"
            className="p-button-text p-button-lg"
            icon="pi pi-pencil"
            onClick={() => {
              setUpsertJobId(rowData.id)
              setUpsertJobSchedule(rowData.schedule)
              setUpsertJobSlackTo(rowData.slack_to)
              setUpsertJobComment(rowData.comment)
              setUpsertJobIsNew(false)
              setShowUpsertJobPopup(true)
            }}
          />
          <Button
            id="delete-refresh-job-button"
            className="p-button-text p-button-lg"
            icon="pi pi-trash"
            onClick={async () => {
              try {
                let { data, error, status } = await supabase
                  .from('refresh_jobs')
                  .update({ deleted_at: new Date() })
                  .eq('id', rowData.id)

                if (error) {
                  throw error
                } else if (data) {
                  analytics.track('delete_refresh_job', {
                    id: rowData.id,
                  })
                  populateRefreshJobs()
                }
              } catch (error: any) {
                console.error(error.message)
              }
            }}
          />
        </>
      )
    },
    [populateRefreshJobs]
  )

  const columnStyle = {
    width: '20%',
    'word-wrap': 'break-word',
    'word-break': 'break-all',
    'white-space': 'normal',
  }

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
              closable={false} // use cancel button instead
              onHide={() => {}} // handled by buttons, but required
            >
              <NewRefreshJobField
                label="Schedule"
                value={upsertJobSchedule}
                setValue={setUpsertJobSchedule}
                tooltip="A cron expression in UTC time; max every-minute frequency"
              />
              <NewRefreshJobField
                label="Slack To"
                value={upsertJobSlackTo}
                setValue={setUpsertJobSlackTo}
                tooltip="Slack webhook urls to be notified upon refresh job completion, comma separated"
              />
              <NewRefreshJobField
                label="Comment"
                value={upsertJobComment}
                setValue={setUpsertJobComment}
                tooltip="Include a comment to help you remember what this refresh job is for"
              />
              <div className={styles.save_cancel_button_container}>
                <Button
                  id="save-refresh-job-button"
                  label="Save"
                  onClick={async () => {
                    if (organizationId) {
                      const now = new Date()
                      let toUpsert = {
                        id: upsertJobId,
                        organization_id: organizationId,
                        schedule: upsertJobSchedule,
                        slack_to: upsertJobSlackTo,
                        comment: upsertJobComment,
                        updated_at: now,
                      } as any
                      if (upsertJobIsNew) {
                        toUpsert = {
                          ...toUpsert,
                          created_at: now,
                        }
                      }
                      try {
                        let { data, error, status } = await supabase
                          .from('refresh_jobs')
                          .upsert([toUpsert])
                          .select()

                        if (error) {
                          throw error
                        }

                        if (data) {
                          analytics.track('create_refresh_job', {
                            id: data[0].id,
                          })
                          populateRefreshJobs()
                          setShowUpsertJobPopup(false)
                          clearFields()
                        }
                      } catch (error: any) {
                        console.error(error.message)
                      }
                    }
                  }}
                />
                <div className={styles.save_cancel_button_spacer} />
                <Button
                  id="cancel-refresh-job-button"
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
              filterDisplay="row"
              emptyMessage="No refresh jobs found"
            >
              <Column field="schedule" header="Schedule" style={columnStyle} />
              <Column field="slack_to" header="Slack To" style={columnStyle} />
              <Column field="comment" header="Comment" style={columnStyle} />
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

export default RefreshJobs
