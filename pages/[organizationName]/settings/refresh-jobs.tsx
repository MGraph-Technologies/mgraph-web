import { EditText } from 'react-edit-text'
import Head from 'next/head'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { OverlayPanel } from 'primereact/overlaypanel'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/RefreshJobs.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

type RefreshJobsProps = {}
const RefreshJobs: FunctionComponent<RefreshJobsProps> = () => {
  const { organizationId } = useAuth()

  const overlayPanel = useRef<OverlayPanel>(null)
  const [newJobSchedule, setNewJobSchedule] = useState<string>('')
  const [newJobEmailTo, setNewJobEmailTo] = useState<string>('')
  const [newJobSlackTo, setNewJobSlackTo] = useState<string>('')

  const clearFields = useCallback(() => {
    setNewJobSchedule('')
    setNewJobEmailTo('')
    setNewJobSlackTo('')
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
          .select('id, schedule, email_to, slack_to, created_at')
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

  const deleteCellBodyTemplate = useCallback(
    (rowData: any) => {
      return (
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

              if (error && status !== 406) {
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
      )
    },
    [populateRefreshJobs]
  )

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
              onClick={(event) => {
                overlayPanel.current?.toggle(event)
              }}
            />
            <OverlayPanel id="new-refresh-job-overlay" ref={overlayPanel}>
              <NewRefreshJobField
                label="Schedule"
                value={newJobSchedule}
                setValue={setNewJobSchedule}
                tooltip="A cron expression in UTC time; max every-minute frequency"
              />
              <NewRefreshJobField
                label="Email To"
                value={newJobEmailTo}
                setValue={setNewJobEmailTo}
                tooltip="Email addresses to be notified upon refresh job completion, comma separated"
              />
              <NewRefreshJobField
                label="Slack To"
                value={newJobSlackTo}
                setValue={setNewJobSlackTo}
                tooltip="Slack channels to be notified upon refresh job completion, comma separated"
              />
              <div className={styles.save_cancel_button_container}>
                <Button
                  id="save-refresh-job-button"
                  label="Save"
                  onClick={async () => {
                    if (organizationId) {
                      try {
                        let { data, error, status } = await supabase
                          .from('refresh_jobs')
                          .insert([
                            {
                              organization_id: organizationId,
                              schedule: newJobSchedule,
                              email_to: newJobEmailTo,
                              slack_to: newJobSlackTo,
                            },
                          ])
                          .select()

                        if (error && status !== 406) {
                          throw error
                        }

                        if (data) {
                          analytics.track('create_refresh_job', {
                            id: data[0].id,
                          })
                          populateRefreshJobs()
                          overlayPanel.current?.hide()
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
                    overlayPanel.current?.hide()
                    clearFields()
                  }}
                />
              </div>
            </OverlayPanel>
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
              <Column field="schedule" header="Schedule" />
              <Column field="email_to" header="Email To" />
              <Column field="slack_to" header="Slack To" />
              <Column field="created_at" header="Created At" />
              <Column body={deleteCellBodyTemplate} align="center" />
            </DataTable>
          </div>
        </div>
      </Workspace>
    </>
  )
}

export default RefreshJobs
