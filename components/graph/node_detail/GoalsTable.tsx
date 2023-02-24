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
import { useAuth } from 'contexts/auth'
import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import { useQueries } from 'contexts/queries'
import styles from 'styles/GoalsTable.module.css'
import { objectToBullets } from 'utils/objectToBullets'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

type GoalDimension = {
  name: string
  value: string
}
export type GoalValue = {
  date: Date
  value: number
}
export type GoalType = 'increase' | 'decrease'
export type GoalStatus =
  | 'achieved'
  | 'missed'
  | 'ahead'
  | 'behind'
  | 'unevaluated'
type GoalProperties = {
  owner: string
  description: string
  type: GoalType
  dimension: GoalDimension
  frequency: string
  values: GoalValue[]
}
type GoalsTableProps = {
  parentNodeId: string
}
const GoalsTable: FunctionComponent<GoalsTableProps> = ({ parentNodeId }) => {
  const { organizationId, userCanEdit } = useAuth()
  const { editingEnabled } = useEditability()
  const { goalStatusMap } = useGraph()
  const { setGlobalSourceRefreshes } = useQueries()
  // NB: refreshes below also push goal inserts/updates/deletes to other users via query listening

  const [goalsTableLoading, setGoalsTableLoading] = useState(true)
  type Goal = {
    id: string
    name: string
    properties: GoalProperties
  }
  const [goals, setGoals] = useState<Goal[]>([])
  const populateGoals = useCallback(async () => {
    if (organizationId) {
      setGoalsTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('columnar_goals')
          .select('id, name, properties')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)
          .eq('parent_node_id', parentNodeId)
          .order('last_date', { ascending: false })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          const _goals = data as {
            id: string
            name: string
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            properties: any
          }[]
          setGoals(
            _goals.map(
              (mr) =>
                ({
                  id: mr.id,
                  name: mr.name,
                  properties: {
                    owner: mr.properties.owner,
                    description: mr.properties.description,
                    dimension: mr.properties.dimension as GoalDimension,
                    frequency: mr.properties.frequency,
                    type: mr.properties.type,
                    values: mr.properties.values.map((v: GoalValue) => ({
                      date: new Date(v.date),
                      value: v.value,
                    })) as GoalValue[],
                  } as GoalProperties,
                } as Goal)
            )
          )
          setGoalsTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId, parentNodeId])
  useEffect(() => {
    populateGoals()
  }, [populateGoals])

  const [goalsTableFirst, setGoalsTableFirst] = useState(0)
  const goalsTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'goals',
      page: e.page,
      first: e.first,
    })
    setGoalsTableFirst(e.first)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propertiesCellBodyTemplate: ColumnBodyType = (rowData: any) => {
    const properties = {
      ...rowData.properties,
    }
    return objectToBullets(properties)
  }

  const statusCellBodyTemplate: ColumnBodyType = (rowData: Goal) => {
    const goalStatus =
      goalStatusMap?.[parentNodeId]?.[rowData.id] ?? 'unevaluated'
    return (
      <GoalStatusIndicator
        id={`goal-status-indicator-${rowData.id}`}
        goalStatus={goalStatus}
      />
    )
  }

  const editCellBodyTemplate: ColumnBodyType = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      const deleteGoal = async () => {
        try {
          const { data, error } = await supabase
            .from('goals')
            .update({ deleted_at: new Date() })
            .eq('id', rowData.id)
            .select('id')
            .single()

          if (error) {
            throw error
          } else if (data) {
            const goal = data as { id: string }
            analytics.track('delete_goal', {
              id: goal.id,
            })
            populateGoals()
            setGlobalSourceRefreshes?.((prev) => prev + 1)
          }
        } catch (error: unknown) {
          console.error(error)
        }
      }
      const confirmDelete = () => {
        confirmDialog({
          message: `Are you sure you want to delete the goal "${rowData.name}"?`,
          icon: 'pi pi-exclamation-triangle',
          accept: deleteGoal,
          acceptLabel: 'Delete',
          rejectLabel: 'Cancel',
          acceptClassName: 'p-button-danger',
        })
      }
      return (
        <>
          <Button
            id="edit-goal-button"
            className="p-button-text p-button-lg"
            icon="pi pi-pencil"
            onClick={() => {
              setUpsertGoalId(rowData.id)
              setUpsertGoalName(rowData.name)
              setUpsertGoalOwner(rowData.properties.owner)
              setUpsertGoalDescription(rowData.properties.description)
              setUpsertGoalDimensionStr(
                JSON.stringify(rowData.properties.dimension)
              )
              setUpsertGoalFrequency(rowData.properties.frequency)
              setUpsertGoalType(rowData.properties.type)
              setUpsertGoalValuesStr(
                rowData.properties.values
                  .map((v: GoalValue) => JSON.stringify(v))
                  .join(', ')
              )
              setUpsertGoalIsNew(false)
              setShowUpsertGoalPopup(true)
            }}
          />
          <Button
            id="delete-goal-button"
            className="p-button-text p-button-lg"
            icon="pi pi-trash"
            onClick={confirmDelete}
          />
        </>
      )
    },
    [populateGoals, setGlobalSourceRefreshes]
  )

  const columnStyle = {
    width: '10%',
    wordWrap: 'break-word',
    wordBreak: 'break-all',
    wordSpace: 'normal',
  } as CSSProperties

  const [showUpsertGoalPopup, setShowUpsertGoalPopup] = useState(false)
  const [upsertGoalId, setUpsertGoalId] = useState<string>('')
  const [upsertGoalName, setUpsertGoalName] = useState<string>('')
  const [upsertGoalOwner, setUpsertGoalOwner] = useState<string>('')
  const [upsertGoalDescription, setUpsertGoalDescription] = useState<string>('')
  const [upsertGoalDimensionStr, setUpsertGoalDimensionStr] =
    useState<string>('')
  const [upsertGoalFrequency, setUpsertGoalFrequency] = useState<string>('')
  const [upsertGoalType, setUpsertGoalType] = useState<string>('')
  const [upsertGoalValuesStr, setUpsertGoalValuesStr] = useState<string>('')
  const [upsertGoalIsNew, setUpsertGoalIsNew] = useState(true)

  const clearFields = useCallback(() => {
    setUpsertGoalId('')
    setUpsertGoalName('')
    setUpsertGoalOwner('')
    setUpsertGoalDescription('')
    setUpsertGoalFrequency('')
    setUpsertGoalDimensionStr('')
    setUpsertGoalType('')
    setUpsertGoalValuesStr('')
    setUpsertGoalIsNew(true)
  }, [])

  const onDialogCancel = useCallback(() => {
    setShowUpsertGoalPopup(false)
    clearFields()
  }, [clearFields])

  return (
    <>
      {userCanEdit && editingEnabled && (
        <div className={styles.new_goal_container}>
          <Button
            id="new-goal-button"
            icon="pi pi-plus"
            onClick={() => {
              setUpsertGoalId(uuidv4())
              setShowUpsertGoalPopup(true)
            }}
          />
          <Dialog
            id="new-goal-dialog"
            header={(upsertGoalIsNew ? 'New' : 'Edit') + ' Goal'}
            visible={showUpsertGoalPopup}
            resizable={false}
            draggable={false}
            onHide={onDialogCancel}
          >
            <SettingsInputText
              label="Goal Name"
              value={upsertGoalName}
              setValue={setUpsertGoalName}
            />
            <SettingsInputText
              label="Goal Owner"
              value={upsertGoalOwner}
              setValue={setUpsertGoalOwner}
              type="mentionableText"
            />
            <SettingsInputText
              label="Goal Description"
              value={upsertGoalDescription}
              setValue={setUpsertGoalDescription}
              type="mentionableText"
            />
            <SettingsInputText
              label="Goal Dimension"
              value={upsertGoalDimensionStr}
              setValue={setUpsertGoalDimensionStr}
              tooltip={
                'A {"name":...,"value":...} object describing the dimension that the goal corresponds to (e.g., ' +
                '{"name":"country","value":"US"} or {"name":null,"value":null}); the Group By input parameter must be set to ' +
                'the value of "name" and the value of "value" must be within query results for goal to be displayed and tracked;'
              }
            />
            <SettingsInputText
              label="Goal Frequency"
              value={upsertGoalFrequency}
              setValue={setUpsertGoalFrequency}
              tooltip={
                'The frequency value that the goal corresponds to (e.g., DAY or WEEK); the Frequency input parameter must ' +
                'be set to this value for goal to be displayed and tracked'
              }
            />
            <label
              htmlFor="goal-type-dropdown"
              style={{ display: 'block', fontWeight: 'bold' }}
            >
              Goal Type
            </label>
            <Dropdown
              id="goal-type-dropdown"
              value={upsertGoalType}
              options={[
                { label: 'increase', value: 'increase' },
                { label: 'decrease', value: 'decrease' },
              ]}
              onChange={(e) => setUpsertGoalType(e.value)}
              style={{ marginBottom: '1rem' }}
            />
            <SettingsInputText
              label="Goal Values"
              value={upsertGoalValuesStr}
              setValue={setUpsertGoalValuesStr}
              tooltip={
                'A comma-separated list of one or more {"date":...,"value":...} objects (e.g., {"date":"2023-01-01","value": 100},' +
                '{"date":"2023-03-01","value":200}); query results must coincide with the dates in this list for goal to be displayed ' +
                'and tracked; gaps will be interpolated linearly'
              }
            />
            <div className={styles.save_cancel_button_container}>
              <Button
                id="save-goal-button"
                label="Save"
                onClick={async () => {
                  // validate dimension
                  const upsertGoalDimensionStrCleaned = upsertGoalDimensionStr
                    .replace(/ /g, '')
                    .replace(/'/g, '"')
                    .replace(/“/g, '"')
                    .replace(/”/g, '"')
                  const upsertGoalDimensionErrorMsg =
                    'Dimension must be a {"name":...,"value":...} object'
                  let upsertGoalDimension = {} as GoalDimension
                  try {
                    upsertGoalDimension = JSON.parse(
                      upsertGoalDimensionStrCleaned
                    )
                  } catch (e) {
                    alert(upsertGoalDimensionErrorMsg)
                    return
                  }
                  if (
                    upsertGoalDimension.name === undefined ||
                    upsertGoalDimension.value === undefined
                  ) {
                    alert(upsertGoalDimensionErrorMsg)
                    return
                  }
                  // validate values
                  const upsertGoalValues: GoalValue[] = []
                  const upsertGoalValuesStrCleaned = upsertGoalValuesStr
                    .replace(/ /g, '')
                    .replace(/'/g, '"')
                    .replace(/“/g, '"')
                    .replace(/”/g, '"')
                  const upsertGoalValuesErrorMsg =
                    'Values must consist of one or more comma-separated {"date":...,"value":...} objects'
                  let upsertGoalValuesArr = []
                  try {
                    upsertGoalValuesArr = JSON.parse(
                      '[' + upsertGoalValuesStrCleaned + ']'
                    )
                  } catch (e) {
                    alert(upsertGoalValuesErrorMsg)
                    return
                  }
                  if (upsertGoalValuesArr.length === 0) {
                    alert(upsertGoalValuesErrorMsg)
                    return
                  }
                  for (const upsertGoalValueObj of upsertGoalValuesArr) {
                    if (
                      upsertGoalValueObj.date === undefined ||
                      upsertGoalValueObj.value === undefined
                    ) {
                      alert(upsertGoalValuesErrorMsg)
                      return
                    }
                    const date = new Date(upsertGoalValueObj.date)
                    if (isNaN(date.getTime())) {
                      alert(upsertGoalValuesErrorMsg)
                      return
                    }
                    const value = parseFloat(upsertGoalValueObj.value)
                    if (isNaN(value)) {
                      alert(upsertGoalValuesErrorMsg)
                      return
                    }
                    upsertGoalValues.push({
                      date: date,
                      value: value,
                    })
                  }
                  // presort to enable first_date and last_date in columnar_goals view
                  upsertGoalValues.sort((a, b) => {
                    return a.date.getTime() - b.date.getTime()
                  })
                  const upsertGoalProperties = {
                    owner: upsertGoalOwner,
                    description: upsertGoalDescription,
                    dimension: upsertGoalDimension,
                    frequency: upsertGoalFrequency,
                    type: upsertGoalType,
                    values: upsertGoalValues,
                  }
                  if (organizationId) {
                    const now = new Date()
                    let toUpsert = {
                      id: upsertGoalId,
                      organization_id: organizationId,
                      parent_node_id: parentNodeId,
                      name: upsertGoalName,
                      properties: upsertGoalProperties,
                      updated_at: now,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                    if (upsertGoalIsNew) {
                      toUpsert = {
                        ...toUpsert,
                        created_at: now,
                      }
                    }
                    try {
                      const { data, error } = await supabase
                        .from('goals')
                        .upsert([toUpsert])
                        .select('id')
                        .single()

                      if (error) {
                        throw error
                      }

                      if (data) {
                        const goal = data as {
                          id: string
                        }
                        analytics.track(
                          upsertGoalIsNew ? 'create_goal' : 'update_goal',
                          {
                            id: goal.id,
                          }
                        )
                        populateGoals()
                        setShowUpsertGoalPopup(false)
                        clearFields()
                        setGlobalSourceRefreshes?.((prev) => prev + 1)
                      }
                    } catch (error: unknown) {
                      console.error(error)
                    }
                  }
                }}
              />
              <div className={styles.save_cancel_button_spacer} />
              <Button
                id="cancel-goal-button"
                className="p-button-outlined"
                label="Cancel"
                onClick={onDialogCancel}
              />
            </div>
          </Dialog>
        </div>
      )}
      <div className={styles.goals_table_container}>
        <DataTable
          paginator={parentNodeId ? false : true}
          scrollable
          id="goals-table"
          className="p-datatable-goals"
          value={goals}
          loading={goalsTableLoading}
          scrollHeight="flex"
          rows={10}
          paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
          first={goalsTableFirst}
          onPage={goalsTableOnPage}
          emptyMessage="No goals added"
        >
          <Column
            field="name"
            header="Name"
            style={{
              ...columnStyle,
              minWidth: '125px',
            }}
          />
          <Column
            header="Properties"
            body={propertiesCellBodyTemplate}
            style={{
              ...columnStyle,
              minWidth: '250px',
            }}
          />
          <Column
            header="Status"
            body={statusCellBodyTemplate}
            align="center"
            style={columnStyle}
          />
          {userCanEdit && editingEnabled && (
            <Column
              body={editCellBodyTemplate}
              align="center"
              style={columnStyle}
            />
          )}
        </DataTable>
      </div>
    </>
  )
}

type GoalStatusIndicatorProps = {
  id: string
  goalStatus: GoalStatus
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void
}
export const GoalStatusIndicator: FunctionComponent<
  GoalStatusIndicatorProps
> = ({ id, goalStatus, onClick = undefined }) => {
  let buttonIcon: string
  let buttonClassExtension: string
  let buttonTooltip: string
  switch (goalStatus) {
    case 'achieved':
      buttonIcon = 'pi pi-check-circle'
      buttonClassExtension = 'p-button-success'
      buttonTooltip =
        'Goal achieved: final goal value was met or exceeded by immediately-preceding actual value'
      break
    case 'missed':
      buttonIcon = 'pi pi-times-circle'
      buttonClassExtension = 'p-button-danger'
      buttonTooltip =
        'Goal missed: final goal value was not met or exceeded by immediately-preceding actual value'
      break
    case 'ahead':
      buttonIcon = 'pi pi-circle'
      buttonClassExtension = 'p-button-success'
      buttonTooltip =
        'Goal ahead: most recent actual value meets or exceeds goal line'
      break
    case 'behind':
      buttonIcon = 'pi pi-circle'
      buttonClassExtension = 'p-button-warning'
      buttonTooltip =
        'Goal behind: most recent actual value does not meet or exceed goal line'
      break
    case 'unevaluated':
      buttonIcon = 'pi pi-question-circle'
      buttonClassExtension = 'p-button-secondary'
      buttonTooltip = 'Goal not evaluated: change input parameters to evaluate'
      break
  }
  return (
    <Button
      id={id}
      className={`p-button-lg p-button-text ${buttonClassExtension}`}
      icon={buttonIcon}
      tooltip={buttonTooltip}
      tooltipOptions={{
        style: { width: '300px' },
      }}
      onClick={onClick}
    />
  )
}

export default GoalsTable
