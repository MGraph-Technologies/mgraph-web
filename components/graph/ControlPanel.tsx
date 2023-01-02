import { Badge } from 'primereact/badge'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { Dropdown } from 'primereact/dropdown'
import { ListBox } from 'primereact/listbox'
import { InputSwitch } from 'primereact/inputswitch'
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

import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import { useQueries } from '../../contexts/queries'
import styles from '../../styles/ControlPanel.module.css'
import { analytics } from '../../utils/segmentClient'
import {
  QueryParameters,
  formQueryParametersScaffold,
} from '../../utils/queryUtils'
import { supabase } from '../../utils/supabaseClient'

type ControlPanelProps = {
  hideEditButton?: boolean
}
const _ControlPanel: FunctionComponent<ControlPanelProps> = ({
  hideEditButton,
}) => {
  const { organizationId, userCanEdit, userIsAdmin } = useAuth()
  const { editingEnabled, enableEditing } = useEditability()
  const showEditButton = userCanEdit && !hideEditButton
  const { graph } = useGraph()
  const {
    globalQueryRefreshes,
    setGlobalQueryRefreshes,
    queriesLoading,
    setQueriesToCancel,
    queryParameters,
    setQueryParameters,
    resetQueryParameterUserValue,
    setQueryParameterUserValue,
    setQueryParameterOrgDefaultValue,
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

  type QueryParameterFieldProps = {
    titleCaseName: string
    picker?: 'boolean' | 'conditions' | 'date' | 'dimension' | 'frequency'
  }
  const QueryParameterField: FunctionComponent<QueryParameterFieldProps> = ({
    titleCaseName,
    picker,
  }) => {
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
      if (queryParameters[snakeCaseName]) {
        setUserValue(queryParameters[snakeCaseName].userValue)
        setOrgDefaultValue(queryParameters[snakeCaseName].orgDefaultValue)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        setQueryParameters!(
          formQueryParametersScaffold([snakeCaseName], queryParameters)
        )
      }
    }, [snakeCaseName])
    useEffect(() => {
      populateParameter()
    }, [populateParameter])

    const setParameter = useCallback(
      (value: string) => {
        analytics.track('set_query_parameter', {
          parameter: snakeCaseName,
          value: value,
        })
        setUserValue(value)
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        setQueryParameterUserValue!(snakeCaseName, value)
      },
      [snakeCaseName]
    )

    const populatePickerOptions = useCallback(async () => {
      if (picker === 'conditions' || picker === 'dimension') {
        const { data, error } = await supabase
          .from('database_query_dimensions')
          .select('name, value')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)

        if (error) {
          console.error(error)
        } else {
          setPickerOptions(
            data.map((d) => {
              return { label: d.name, value: d.value }
            })
          )
        }
      } else if (picker === 'frequency') {
        setPickerOptions([
          { label: 'SECOND', value: 'SECOND' },
          { label: 'MINUTE', value: 'MINUTE' },
          { label: 'HOUR', value: 'HOUR' },
          { label: 'DAY', value: 'DAY' },
          { label: 'WEEK', value: 'WEEK' },
          { label: 'MONTH', value: 'MONTH' },
          { label: 'QUARTER', value: 'QUARTER' },
          { label: 'YEAR', value: 'YEAR' },
        ])
      }
    }, [picker])
    useEffect(() => {
      populatePickerOptions()
    }, [populatePickerOptions])

    // close pickerOverlayPanel if queryParametersOverlayPanel is clicked
    useEffect(() => {
      const queryParametersOverlay = document.getElementById(
        'query-parameters-overlay'
      )
      if (queryParametersOverlay) {
        const hideOverlayPanel = () => {
          pickerOverlayPanel.current?.hide()
        }
        queryParametersOverlay.addEventListener('click', hideOverlayPanel)
        return () => {
          queryParametersOverlay.removeEventListener('click', hideOverlayPanel)
        }
      }
    }, [])

    return (
      <div
        id={snakeCaseName + '-field-container'}
        className={styles.query_parameter_field_container}
      >
        <span>
          <b>
            <label htmlFor={snakeCaseName + '-field'}>{titleCaseName}</label>
          </b>
          {picker === 'boolean' ? (
            <InputSwitch
              id={snakeCaseName + '-field'}
              className={styles.query_parameter_field_picker_boolean}
              checked={userValue === 'TRUE'}
              onChange={(e) => {
                setParameter(e.value ? 'TRUE' : 'FALSE')
              }}
            />
          ) : (
            <EditText
              id={snakeCaseName + '-field'}
              className={styles.query_parameter_field}
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
                analytics.track('reset_query_parameter', {
                  parameter: snakeCaseName,
                })
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                resetQueryParameterUserValue!(snakeCaseName)
              }}
            />
            {userIsAdmin && (
              <Button
                id={snakeCaseName + '-set-default-button'}
                label="Set Default"
                className="p-button-rounded p-button-text p-button-sm"
                onClick={() => {
                  analytics.track('set_query_parameter_org_default', {
                    parameter: snakeCaseName,
                    value: userValue,
                  })
                  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                  setQueryParameterOrgDefaultValue!(snakeCaseName, userValue)
                }}
              />
            )}
          </>
        )}
        {((picker && (pickerOptions?.length || 0) > 0) ||
          picker === 'date') && (
          <OverlayPanel
            id={snakeCaseName + '-field-picker-overlay'}
            ref={pickerOverlayPanel}
          >
            {picker === 'conditions' && (
              <>
                {userValue && (
                  <Dropdown
                    id={snakeCaseName + '-condition-conjunction-picker'}
                    className={styles.query_parameter_field_picker}
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
                  className={styles.query_parameter_field_picker}
                  value={wipCondition.dimension}
                  options={pickerOptions}
                  onChange={(e) => {
                    setWipCondition({ ...wipCondition, dimension: e.value })
                  }}
                  placeholder="Dimension"
                />
                <Dropdown
                  id={snakeCaseName + '-condition-operator-picker'}
                  className={styles.query_parameter_field_picker}
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
                  className={styles.query_parameter_field_picker}
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
              <div className={styles.query_parameter_field_picker_calendar}>
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
                <div className={styles.query_parameter_picker_calendar_tip}>
                  Pro tip: you can also type values above, including relative
                  ones like CURRENT_DATE - INTERVAL &apos;90 DAY&apos;
                </div>
              </div>
            )}
            {(picker === 'dimension' || picker === 'frequency') && (
              <ListBox
                className={styles.query_parameter_field_picker}
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

  const [queryParameterUserValueInEffect, setQueryParameterUserValueInEffect] =
    useState(false)
  useEffect(() => {
    setQueryParameterUserValueInEffect(
      Object.keys(queryParameters).some(
        (key) =>
          queryParameters[key].userValue !==
          queryParameters[key].orgDefaultValue
      )
    )
  }, [queryParameters])

  const queryParametersOverlayPanel = useRef<OverlayPanel>(null)
  const [
    queryParametersOverlayPanelVisible,
    setQueryParametersOverlayPanelVisible,
  ] = useState(false)
  const [initialQueryParameters, setInitialQueryParameters] =
    useState<QueryParameters>({})
  const refreshQueryIfParametersChanged = useCallback(() => {
    const parameterChanged = Object.keys(queryParameters).some((key) => {
      return (
        Object.keys(initialQueryParameters).length > 0 &&
        queryParameters[key]?.userValue !==
          initialQueryParameters[key]?.userValue
      )
    })
    if (parameterChanged) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setGlobalQueryRefreshes!((prev) => prev + 1)
      setInitialQueryParameters(queryParameters)
    }
  }, [queryParameters, initialQueryParameters, setGlobalQueryRefreshes])
  useEffect(() => {
    if (!queryParametersOverlayPanelVisible) {
      refreshQueryIfParametersChanged()
    }
  }, [queryParametersOverlayPanelVisible, refreshQueryIfParametersChanged])

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
                  queryParametersOverlayPanel.current?.toggle(event)
                }}
              >
                {queryParameterUserValueInEffect && <Badge severity="danger" />}
              </Button>
              <Button
                id="global-query-refresh-button"
                className={styles.button}
                icon="pi pi-refresh"
                onClick={() => {
                  if (setGlobalQueryRefreshes) {
                    analytics.track('refresh_queries')
                    setGlobalQueryRefreshes(globalQueryRefreshes + 1)
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
          id="query-parameters-overlay"
          ref={queryParametersOverlayPanel}
          onShow={() => {
            setInitialQueryParameters(queryParameters)
            setQueryParametersOverlayPanelVisible(true)
          }}
          onHide={() => {
            setQueryParametersOverlayPanelVisible(false)
          }}
        >
          <div className={styles.query_parameters_container}>
            <QueryParameterField titleCaseName="Beginning Date" picker="date" />
            <QueryParameterField titleCaseName="Ending Date" picker="date" />
            <QueryParameterField titleCaseName="Frequency" picker="frequency" />
            <QueryParameterField titleCaseName="Group By" picker="dimension" />
            <QueryParameterField
              titleCaseName="Conditions"
              picker="conditions"
            />
            <QueryParameterField
              titleCaseName="Show Unfinished Values"
              picker="boolean"
            />
          </div>
        </OverlayPanel>
      </div>
    )
  }
}

const ControlPanel = React.memo(_ControlPanel)
export default ControlPanel
