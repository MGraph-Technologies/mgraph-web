import { Badge } from 'primereact/badge'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Checkbox } from 'primereact/checkbox'
import { Dropdown } from 'primereact/dropdown'
import { ListBox } from 'primereact/listbox'
import { InputText } from 'primereact/inputtext'
import { OverlayPanel, OverlayPanelEventType } from 'primereact/overlaypanel'
import { SelectItemOptionsType } from 'primereact/selectitem'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { EditText } from 'react-edit-text'

import { useAuth } from 'contexts/auth'
import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import { useQueries } from 'contexts/queries'
import styles from 'styles/ControlPanel.module.css'
import { InputParameters, formInputParametersScaffold } from 'utils/queryUtils'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

type ControlPanelProps = {
  hideEditButton?: boolean
}
const _ControlPanel: FunctionComponent<ControlPanelProps> = ({
  hideEditButton,
}) => {
  const { userCanEdit } = useAuth()
  const { editingEnabled, enableEditing } = useEditability()
  const showEditButton = userCanEdit && !hideEditButton
  const { graph } = useGraph()
  const {
    setGlobalSourceRefreshes,
    queriesLoading,
    setQueriesToCancel,
    inputParameters,
  } = useQueries()

  const [graphLoading, setGraphloading] = useState(true)
  useEffect(() => {
    if (graph.nodes.length > 0) {
      // little buffer to avoid flickering before queries are loaded
      setTimeout(() => {
        setGraphloading(false)
      }, 100)
    }
  }, [graph])

  const [inputParameterUserValueInEffect, setInputParameterUserValueInEffect] =
    useState(false)
  useEffect(() => {
    setInputParameterUserValueInEffect(
      Object.keys(inputParameters).some(
        (key) =>
          inputParameters[key].userValue !==
          inputParameters[key].orgDefaultValue
      )
    )
  }, [inputParameters])

  const inputParametersOverlayPanel = useRef<OverlayPanel>(null)
  const [
    inputParametersOverlayPanelVisible,
    setInputParametersOverlayPanelVisible,
  ] = useState(false)
  const [initialInputParameters, setInitialInputParameters] =
    useState<InputParameters>({})
  const refreshSourcesIfParametersChanged = useCallback(() => {
    const parameterChanged = Object.keys(inputParameters).some((key) => {
      return (
        Object.keys(initialInputParameters).length > 0 &&
        inputParameters[key]?.userValue !==
          initialInputParameters[key]?.userValue
      )
    })
    if (parameterChanged) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setGlobalSourceRefreshes!((prev) => prev + 1)
      setInitialInputParameters(inputParameters)
    }
  }, [inputParameters, initialInputParameters, setGlobalSourceRefreshes])
  useEffect(() => {
    if (!inputParametersOverlayPanelVisible) {
      refreshSourcesIfParametersChanged()
    }
  }, [inputParametersOverlayPanelVisible, refreshSourcesIfParametersChanged])

  if (editingEnabled) {
    return null
  } else {
    return (
      <div className={styles.control_panel}>
        {
          // prettier-ignore
          graph.nodes.length === 0 
          ? null 
          : graphLoading || queriesLoading.length > 0 ? (
            <>
              <Button
                id="graph-loading-cancel-button"
                className={`${styles.button} p-button-text`}
                icon="pi pi-times-circle"
                onClick={() => {
                  if (queriesLoading) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    setQueriesToCancel!(
                      [...queriesLoading]
                    )
                  }
                }}
              />
              <Button
                id="graph-loading-indicator-button"
                className={styles.button}
                icon="pi pi-refresh"
                loading
              />
            </>
          ) : (
            <>
              <Button
                id="query-settings-button"
                className={`${styles.button} p-overlay-badge p-button-icon-only`}
                icon="pi pi-sliders-h"
                onClick={(event) => {
                  analytics.track('view_query_settings')
                  inputParametersOverlayPanel.current?.toggle(event)
                }}
              >
                {inputParameterUserValueInEffect && <Badge severity="danger" />}
              </Button>
              <Button
                id="global-source-refresh-button"
                className={styles.button}
                icon="pi pi-refresh"
                onClick={() => {
                  if (setGlobalSourceRefreshes) {
                    analytics.track('refresh_sources')
                    setGlobalSourceRefreshes((prev) => prev + 1)
                  }
                }}
              />
            </>
          )
        }
        {showEditButton ? (
          <Button
            id="edit-button"
            className={styles.button}
            icon="pi pi-pencil"
            onClick={() => {
              analytics.track('enable_editing')
              enableEditing()
            }}
          />
        ) : null}
        <OverlayPanel
          id="input-parameters-overlay"
          ref={inputParametersOverlayPanel}
          onShow={() => {
            setInitialInputParameters(inputParameters)
            setInputParametersOverlayPanelVisible(true)
          }}
          onHide={() => {
            setInputParametersOverlayPanelVisible(false)
          }}
        >
          <div className={styles.input_parameters_container}>
            <InputParameterField titleCaseName="Beginning Date" picker="date" />
            <InputParameterField titleCaseName="Ending Date" picker="date" />
            <InputParameterField titleCaseName="Frequency" picker="frequency" />
            <InputParameterField titleCaseName="Group By" picker="dimension" />
            <InputParameterField
              titleCaseName="Conditions"
              picker="conditions"
            />
            <InputParameterField
              titleCaseName="Show Unfinished Values"
              picker="boolean"
            />
          </div>
        </OverlayPanel>
      </div>
    )
  }
}

type InputParameterFieldProps = {
  titleCaseName: string
  picker?: 'boolean' | 'conditions' | 'date' | 'dimension' | 'frequency'
}
const InputParameterField: FunctionComponent<InputParameterFieldProps> = ({
  titleCaseName,
  picker,
}) => {
  const { organizationId, userIsAdmin } = useAuth()
  const {
    inputParameters,
    setInputParameters,
    resetInputParameterUserValue,
    setInputParameterUserValue,
    setInputParameterOrgDefaultValue,
  } = useQueries()

  const snakeCaseName = titleCaseName.toLowerCase().replace(/ /g, '_')
  const [userValue, setUserValue] = useState('')
  const [orgDefaultValue, setOrgDefaultValue] = useState('')
  const pickerOverlayPanel = useRef<OverlayPanel>(null)
  const [pickerOptions, setPickerOptions] = useState<
    SelectItemOptionsType | undefined
  >(undefined)
  const [wipCondition, setWipCondition] = useState({
    conjunction: 'AND',
    dimension: '',
    operator: '',
    value: '',
  })

  const populateParameter = useCallback(() => {
    if (inputParameters[snakeCaseName]) {
      setUserValue(inputParameters[snakeCaseName].userValue)
      setOrgDefaultValue(inputParameters[snakeCaseName].orgDefaultValue)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setInputParameters!(
        formInputParametersScaffold([snakeCaseName], inputParameters)
      )
    }
  }, [snakeCaseName, inputParameters, setInputParameters])
  useEffect(() => {
    populateParameter()
  }, [populateParameter])

  const setParameter = useCallback(
    (value: string) => {
      analytics.track('set_input_parameter', {
        parameter: snakeCaseName,
        value: value,
      })
      setUserValue(value)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setInputParameterUserValue!(snakeCaseName, value)
    },
    [snakeCaseName, setInputParameterUserValue]
  )

  const populatePickerOptions = useCallback(async () => {
    if (!['conditions', 'dimension', 'frequency'].includes(picker || '')) {
      return
    }
    const { data, error } = await supabase
      .from('organizations')
      .select('query_dimensions, query_frequencies')
      .is('deleted_at', null)
      .eq('id', organizationId)
      .single()

    if (error) {
      console.error(error)
    }

    if (data) {
      const organization = data as {
        query_dimensions: string
        query_frequencies: string
      }
      const colName = `query_${
        picker == 'frequency' ? 'frequencies' : 'dimensions'
      }` as 'query_dimensions' | 'query_frequencies'
      setPickerOptions(
        organization[colName].split(',').map((option: string) => {
          return { label: option, value: option }
        })
      )
    }
  }, [picker, organizationId])
  useEffect(() => {
    populatePickerOptions()
  }, [populatePickerOptions])

  // close pickerOverlayPanel if inputParametersOverlayPanel is clicked
  useEffect(() => {
    const inputParametersOverlay = document.getElementById(
      'input-parameters-overlay'
    )
    if (inputParametersOverlay) {
      const hideOverlayPanel = () => {
        pickerOverlayPanel.current?.hide()
      }
      inputParametersOverlay.addEventListener('click', hideOverlayPanel)
      return () => {
        inputParametersOverlay.removeEventListener('click', hideOverlayPanel)
      }
    }
  }, [])

  return (
    <div
      id={snakeCaseName + '-field-container'}
      className={styles.input_parameter_field_container}
    >
      <span>
        <b>
          <label htmlFor={snakeCaseName + '-field'}>{titleCaseName}</label>
        </b>
        {picker === 'boolean' ? (
          <Checkbox
            id={snakeCaseName + '-field'}
            className={styles.input_parameter_field_picker_boolean}
            checked={userValue === 'TRUE'}
            onChange={(e) => {
              setParameter(e.checked ? 'TRUE' : 'FALSE')
            }}
          />
        ) : (
          <EditText
            id={snakeCaseName + '-field'}
            className={styles.input_parameter_field}
            value={userValue}
            onEditMode={() => {
              pickerOverlayPanel.current?.show(
                {} as OverlayPanelEventType,
                document.getElementById(
                  snakeCaseName + '-field-picker-overlay-anchor'
                )
              )
            }}
            onChange={(e) => {
              setUserValue(e.target.value)
            }}
            onSave={({ value }) => {
              setParameter(value)
            }}
          />
        )}
      </span>
      <div id={snakeCaseName + '-field-picker-overlay-anchor'} />
      {!(userValue === orgDefaultValue) && (
        <>
          <Button
            id={snakeCaseName + '-reset-button'}
            label="Reset"
            className="p-button-rounded p-button-text p-button-sm"
            onClick={() => {
              analytics.track('reset_input_parameter', {
                parameter: snakeCaseName,
              })
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              resetInputParameterUserValue!(snakeCaseName)
            }}
          />
          {userIsAdmin && (
            <Button
              id={snakeCaseName + '-set-default-button'}
              label="Set Default"
              className="p-button-rounded p-button-text p-button-sm"
              onClick={() => {
                analytics.track('set_input_parameter_org_default', {
                  parameter: snakeCaseName,
                  value: userValue,
                })
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                setInputParameterOrgDefaultValue!(snakeCaseName, userValue)
              }}
            />
          )}
        </>
      )}
      {((picker && (pickerOptions?.length || 0) > 0) || picker === 'date') && (
        <OverlayPanel
          id={snakeCaseName + '-field-picker-overlay'}
          ref={pickerOverlayPanel}
        >
          {picker === 'conditions' && (
            <>
              {userValue && (
                <Dropdown
                  id={snakeCaseName + '-condition-conjunction-picker'}
                  className={styles.input_parameter_field_picker}
                  value={wipCondition.conjunction}
                  options={[
                    { label: 'AND', value: 'AND' },
                    { label: 'OR', value: 'OR' },
                  ]}
                  onChange={(e) => {
                    setWipCondition({ ...wipCondition, conjunction: e.value })
                  }}
                  placeholder="Conjunction"
                />
              )}
              <Dropdown
                id={snakeCaseName + '-condition-dimension-picker'}
                className={styles.input_parameter_field_picker}
                value={wipCondition.dimension}
                options={pickerOptions}
                onChange={(e) => {
                  setWipCondition({ ...wipCondition, dimension: e.value })
                }}
                placeholder="Dimension"
              />
              <Dropdown
                id={snakeCaseName + '-condition-operator-picker'}
                className={styles.input_parameter_field_picker}
                value={wipCondition.operator}
                options={[
                  { label: '=', value: '=' },
                  { label: '!=', value: '!=' },
                  { label: '<', value: '<' },
                  { label: '<=', value: '<=' },
                  { label: '>', value: '>' },
                  { label: '>=', value: '>=' },
                  { label: 'IN', value: 'IN' },
                  { label: 'NOT IN', value: 'NOT IN' },
                  { label: 'LIKE', value: 'LIKE' },
                  { label: 'NOT LIKE', value: 'NOT LIKE' },
                ]}
                onChange={(e) => {
                  setWipCondition({ ...wipCondition, operator: e.value })
                }}
                placeholder="Operator"
              />
              <InputText
                id={snakeCaseName + '-condition-value-field'}
                className={styles.input_parameter_field_picker}
                value={wipCondition.value}
                onChange={(e) => {
                  setWipCondition({ ...wipCondition, value: e.target.value })
                }}
                placeholder="Value"
              />
              <br />
              <Button
                id={snakeCaseName + '-condition-add-button'}
                label="Add Condition"
                onClick={() => {
                  if (
                    (userValue && !wipCondition.conjunction) ||
                    !wipCondition.dimension ||
                    !wipCondition.operator
                  )
                    return
                  const newCondition = `${wipCondition.conjunction} ${wipCondition.dimension} ${wipCondition.operator} ${wipCondition.value}`
                  const newConditions = userValue
                    ? userValue + ' ' + newCondition
                    : newCondition
                  setParameter(newConditions)
                  setWipCondition({
                    conjunction: 'AND',
                    dimension: '',
                    operator: '',
                    value: '',
                  })
                  pickerOverlayPanel.current?.hide()
                }}
                style={{ float: 'right', margin: '5px 0px' }}
              />
            </>
          )}
          {picker === 'date' && (
            <div className={styles.input_parameter_field_picker_calendar}>
              <Calendar
                inline
                value={new Date(userValue)}
                onChange={(e) => {
                  if (!e.value) return
                  const val = e.value as Date
                  const dateStr = `'${val.toISOString().split('T')[0]}'`
                  setParameter(dateStr)
                }}
                panelStyle={{ border: '0px' }}
              />
              <div className={styles.input_parameter_picker_calendar_tip}>
                Pro tip: you can also type values above, including relative ones
                like CURRENT_DATE - INTERVAL &apos;90 DAY&apos;
              </div>
            </div>
          )}
          {(picker === 'dimension' || picker === 'frequency') && (
            <ListBox
              className={styles.input_parameter_field_picker}
              options={pickerOptions}
              onChange={(e) => {
                setParameter(e.value)
              }}
            />
          )}
        </OverlayPanel>
      )}
    </div>
  )
}

const ControlPanel = React.memo(_ControlPanel)
export default ControlPanel
