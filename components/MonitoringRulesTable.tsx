import { isValidCron } from 'cron-validator'
import { Button } from 'primereact/button'
import { Column, ColumnBodyType } from 'primereact/column'
import { DataTable, DataTablePFSEvent } from 'primereact/datatable'
import { Dialog } from 'primereact/dialog'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import SettingsInputText from './SettingsInputText'
import { useAuth } from '../contexts/auth'
import styles from '../styles/MonitoringRulesTable.module.css'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'
import { QueryParameterOverrides } from '../utils/queryUtils'
import { Dropdown } from 'primereact/dropdown'

export type AlertIfValueOption =
  | 'insideRangeInclusive'
  | 'outsideRangeExclusive'
export type MonitoringRuleProperties = {
  alertIfValue: AlertIfValueOption
  rangeLowerBound: number
  rangeUpperBound: number
  lookbackPeriods: number
  queryParameterOverrides: QueryParameterOverrides
}

type MonitoringRulesTableProps = {
  parentNodeId: string
}
const MonitoringRulesTable: FunctionComponent<MonitoringRulesTableProps> = ({
  parentNodeId,
}) => {
  const { organizationId, userCanEdit } = useAuth()

  const [monitoringRulesTableLoading, setMonitoringRulesTableLoading] =
    useState(true)
  type MonitoringRule = {
    id: string
    properties: MonitoringRuleProperties
    schedule: string
    slack_to: string
    comment: string
    created_at: string
  }
  const [monitoringRules, setMonitoringRules] = useState<MonitoringRule[]>([])
  const populateMonitoringRules = useCallback(async () => {
    if (organizationId) {
      setMonitoringRulesTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('monitoring_rules')
          .select(
            'id, properties, schedule, slack_to, comment, created_at, updated_at'
          )
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .eq('parent_node_id', parentNodeId)
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setMonitoringRules(data as MonitoringRule[])
          setMonitoringRulesTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId, parentNodeId])
  useEffect(() => {
    populateMonitoringRules()
  }, [populateMonitoringRules])

  const [monitoringRulesTableFirst, setMonitoringRulesTableFirst] = useState(0)
  const monitoringRulesTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'monitoring_rules',
      page: e.page,
      first: e.first,
    })
    setMonitoringRulesTableFirst(e.first)
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

  const editCellBodyTemplate: ColumnBodyType = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      return (
        <>
          <Button
            id="edit-monitoring-rule-button"
            className="p-button-text p-button-lg"
            icon="pi pi-pencil"
            onClick={() => {
              setUpsertRuleId(rowData.id)
              setUpsertRuleAlertIfValue(rowData.properties.alertIfValue)
              setUpsertRuleRangeLowerBoundStr(
                rowData.properties.rangeLowerBound
              )
              setUpsertRuleRangeUpperBoundStr(
                rowData.properties.rangeUpperBound
              )
              setUpsertRuleLookbackPeriodsStr(
                rowData.properties.lookbackPeriods
              )
              setUpsertRuleQueryParameterOverridesStr(
                Object.entries(rowData.properties.queryParameterOverrides)
                  .map(([key, value]) => `${key}:${value}`)
                  .join(',')
              )
              setUpsertRuleSchedule(rowData.schedule)
              setUpsertRuleSlackTo(rowData.slack_to)
              setUpsertRuleComment(rowData.comment)
              setUpsertRuleIsNew(false)
              setShowUpsertRulePopup(true)
            }}
          />
          <Button
            id="delete-monitoring-rule-button"
            className="p-button-text p-button-lg"
            icon="pi pi-trash"
            onClick={async () => {
              try {
                const { data, error } = await supabase
                  .from('monitoring_rules')
                  .update({ deleted_at: new Date() })
                  .eq('id', rowData.id)

                if (error) {
                  throw error
                } else if (data) {
                  analytics.track('delete_monitoring_rule', {
                    id: rowData.id,
                  })
                  populateMonitoringRules()
                }
              } catch (error: unknown) {
                console.error(error)
              }
            }}
          />
        </>
      )
    },
    [populateMonitoringRules]
  )

  const columnStyle = {
    width: '10%',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
    wordSpace: 'normal',
  }

  const [showUpsertRulePopup, setShowUpsertRulePopup] = useState(false)
  const [upsertRuleId, setUpsertRuleId] = useState<string>('')
  const [upsertRuleAlertIfValue, setUpsertRuleAlertIfValue] =
    useState<AlertIfValueOption>('insideRangeInclusive')
  const [upsertRuleRangeLowerBoundStr, setUpsertRuleRangeLowerBoundStr] =
    useState('')
  const [upsertRuleRangeUpperBoundStr, setUpsertRuleRangeUpperBoundStr] =
    useState('')
  const [upsertRuleLookbackPeriodsStr, setUpsertRuleLookbackPeriodsStr] =
    useState('')
  const [
    upsertRuleQueryParameterOverridesStr,
    setUpsertRuleQueryParameterOverridesStr,
  ] = useState('')
  const [upsertRuleSchedule, setUpsertRuleSchedule] = useState<string>('')
  const [upsertRuleSlackTo, setUpsertRuleSlackTo] = useState<string>('')
  const [upsertRuleComment, setUpsertRuleComment] = useState<string>('')
  const [upsertRuleIsNew, setUpsertRuleIsNew] = useState(true)

  const clearFields = useCallback(() => {
    setUpsertRuleId('')
    setUpsertRuleAlertIfValue('insideRangeInclusive')
    setUpsertRuleRangeLowerBoundStr('')
    setUpsertRuleRangeUpperBoundStr('')
    setUpsertRuleLookbackPeriodsStr('')
    setUpsertRuleQueryParameterOverridesStr('')
    setUpsertRuleSchedule('')
    setUpsertRuleSlackTo('')
    setUpsertRuleComment('')
    setUpsertRuleIsNew(true)
  }, [])

  return (
    <>
      {userCanEdit && (
        <div className={styles.new_monitoring_rule_container}>
          <Button
            id="new-monitoring-rule-button"
            icon="pi pi-plus"
            onClick={() => {
              setUpsertRuleId(uuidv4())
              setShowUpsertRulePopup(true)
            }}
          />
          <Dialog
            id="new-monitoring-rule-dialog"
            header={(upsertRuleIsNew ? 'New' : 'Edit') + ' Monitoring Rule'}
            visible={showUpsertRulePopup}
            resizable={false}
            draggable={false}
            closable={false} // use cancel button instead
            onHide={() => {
              return
            }} // handled by buttons, but required
          >
            <label
              htmlFor="upsert-rule-alert-if-value-dropdown"
              style={{ display: 'block', fontWeight: 'bold' }}
            >
              Alert If Value
            </label>
            <Dropdown
              id="upsert-rule-alert-if-value-dropdown"
              value={upsertRuleAlertIfValue}
              options={[
                {
                  label: 'Inside Range (inclusive)',
                  value: 'insideRangeInclusive' as AlertIfValueOption,
                },
                {
                  label: 'Outside Range (exclusive)',
                  value: 'outsideRangeExclusive' as AlertIfValueOption,
                },
              ]}
              onChange={(e) => setUpsertRuleAlertIfValue(e.value)}
              style={{ marginBottom: '1rem' }}
            />
            <SettingsInputText
              label="Range Lower Bound"
              value={upsertRuleRangeLowerBoundStr}
              setValue={setUpsertRuleRangeLowerBoundStr}
              tooltip="The lower bound of the range to alert on (e.g., 1, -0.23, or -Infinity)"
            />
            <SettingsInputText
              label="Range Upper Bound"
              value={upsertRuleRangeUpperBoundStr}
              setValue={setUpsertRuleRangeUpperBoundStr}
              tooltip="The upper bound of the range to alert on (e.g., 4, 0.56, or Infinity)"
            />
            <SettingsInputText
              label="Lookback Periods"
              value={upsertRuleLookbackPeriodsStr}
              setValue={setUpsertRuleLookbackPeriodsStr}
              tooltip="The n most-recent source query result values to evaluate for each dimension (e.g., 1 or 24)"
            />
            <SettingsInputText
              label="Query Parameter Overrides"
              value={upsertRuleQueryParameterOverridesStr}
              setValue={setUpsertRuleQueryParameterOverridesStr}
              tooltip="(optional) Parameter:Value pairs to override default query paramters (comma-separated without added quotes; e.g., beginning_date:2021-01-01,ending_date:2021-01-31)"
            />
            <SettingsInputText
              label="Schedule"
              value={upsertRuleSchedule}
              setValue={setUpsertRuleSchedule}
              tooltip="A cron expression in UTC time describing the cadence on which to evaluate the rule; max every-minute frequency"
            />
            <SettingsInputText
              label="Slack To"
              value={upsertRuleSlackTo}
              setValue={setUpsertRuleSlackTo}
              tooltip="(optional) Slack webhook urls to receive alerts, comma separated"
            />
            <SettingsInputText
              label="Comment"
              value={upsertRuleComment}
              setValue={setUpsertRuleComment}
              tooltip="(optional) A brief description of the rule"
            />
            <div className={styles.save_cancel_button_container}>
              <Button
                id="save-monitoring-rule-button"
                label="Save"
                onClick={async () => {
                  // validate properties
                  const upsertRuleRangeLowerBound = parseFloat(
                    upsertRuleRangeLowerBoundStr
                  )
                  if (isNaN(upsertRuleRangeLowerBound)) {
                    alert('Range Lower Bound must be a number')
                    return
                  }
                  const upsertRuleRangeUpperBound = parseFloat(
                    upsertRuleRangeUpperBoundStr
                  )
                  if (isNaN(upsertRuleRangeUpperBound)) {
                    alert('Range Upper Bound must be a number')
                    return
                  }
                  const upsertRuleLookbackPeriods = parseInt(
                    upsertRuleLookbackPeriodsStr
                  )
                  if (isNaN(upsertRuleLookbackPeriods)) {
                    alert('Lookback Periods must be an integer')
                    return
                  }
                  const upsertRuleQueryParameterOverrides: QueryParameterOverrides =
                    {}
                  for (const overridePair of upsertRuleQueryParameterOverridesStr.split(
                    ','
                  )) {
                    if (overridePair) {
                      const overridePairSplit = overridePair.split(':')
                      if (!(overridePairSplit.length === 2)) {
                        alert(
                          'Query Parameter Overrides must be in the format parameter:value'
                        )
                        return
                      }
                      const key = overridePairSplit[0].trim()
                      const value = overridePairSplit[1].trim()
                      upsertRuleQueryParameterOverrides[key] = value
                    }
                  }
                  const upsertRuleProperties = {
                    alertIfValue: upsertRuleAlertIfValue,
                    rangeLowerBound:
                      Math.abs(upsertRuleRangeLowerBound) === Infinity
                        ? upsertRuleRangeLowerBound.toString()
                        : upsertRuleRangeLowerBound,
                    rangeUpperBound:
                      Math.abs(upsertRuleRangeUpperBound) === Infinity
                        ? upsertRuleRangeUpperBound.toString()
                        : upsertRuleRangeUpperBound,
                    lookbackPeriods: upsertRuleLookbackPeriods,
                    queryParameterOverrides: upsertRuleQueryParameterOverrides,
                  }

                  // validate schedule
                  if (!isValidCron(upsertRuleSchedule)) {
                    alert('Schedule must be a valid cron expression')
                    return
                  }

                  if (organizationId) {
                    const now = new Date()
                    let toUpsert = {
                      id: upsertRuleId,
                      organization_id: organizationId,
                      parent_node_id: parentNodeId,
                      properties: upsertRuleProperties,
                      schedule: upsertRuleSchedule,
                      slack_to: upsertRuleSlackTo,
                      comment: upsertRuleComment,
                      updated_at: now,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                    if (upsertRuleIsNew) {
                      toUpsert = {
                        ...toUpsert,
                        created_at: now,
                      }
                    }
                    try {
                      const { data, error } = await supabase
                        .from('monitoring_rules')
                        .upsert([toUpsert])
                        .select()

                      if (error) {
                        throw error
                      }

                      if (data) {
                        analytics.track(
                          upsertRuleIsNew
                            ? 'create_monitoring_rule'
                            : 'update_monitoring_rule',
                          {
                            id: data[0].id,
                          }
                        )
                        populateMonitoringRules()
                        setShowUpsertRulePopup(false)
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
                id="cancel-monitoring-rule-button"
                className="p-button-outlined"
                label="Cancel"
                onClick={() => {
                  setShowUpsertRulePopup(false)
                  clearFields()
                }}
              />
            </div>
          </Dialog>
        </div>
      )}
      <div className={styles.monitoring_rules_table_container}>
        <DataTable
          paginator={parentNodeId ? false : true}
          scrollable
          id="monitoring-rules-table"
          className="p-datatable-monitoring_rules"
          value={monitoringRules}
          loading={monitoringRulesTableLoading}
          scrollHeight="flex"
          rows={10}
          paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
          first={monitoringRulesTableFirst}
          onPage={monitoringRulesTableOnPage}
          filterDisplay="row"
          emptyMessage="No monitoring rules found"
        >
          <Column
            field="properties"
            header="Properties"
            body={propertiesCellBodyTemplate}
            style={{
              ...columnStyle,
              minWidth: '250px',
            }}
          />
          <Column field="schedule" header="Schedule" style={columnStyle} />
          <Column field="slack_to" header="Slack To" style={columnStyle} />
          <Column field="comment" header="Comment" style={columnStyle} />
          <Column field="updated_at" header="Updated At" style={columnStyle} />
          {userCanEdit && <Column body={editCellBodyTemplate} align="center" />}
        </DataTable>
      </div>
    </>
  )
}

export default MonitoringRulesTable
