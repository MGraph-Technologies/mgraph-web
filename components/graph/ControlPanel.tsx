import { Badge } from 'primereact/badge'
import { Button } from 'primereact/button'
import { Calendar } from 'primereact/calendar'
import { ListBox } from 'primereact/listbox'
import { OverlayPanel, OverlayPanelEventType } from 'primereact/overlaypanel'
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

type ControlPanelProps = {
  hideEditButton?: boolean
}
const _ControlPanel: FunctionComponent<ControlPanelProps> = ({
  hideEditButton,
}) => {
  const { userCanEdit, userIsAdmin } = useAuth()
  const { editingEnabled, enableEditing } = useEditability()
  const showEditButton = userCanEdit && !hideEditButton
  const { graph } = useGraph()
  const {
    globalQueryRefreshes,
    setGlobalQueryRefreshes,
    queriesLoading,
    setQueriesToCancel,
    queryParameters,
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
    picker?: 'date' | 'frequency'
  }
  const QueryParameterField: FunctionComponent<QueryParameterFieldProps> = ({
    titleCaseName,
    picker,
  }) => {
    const snakeCaseName = titleCaseName.toLowerCase().replace(/ /g, '_')
    const [userValue, setUserValue] = useState('')
    const [orgDefaultValue, setOrgDefaultValue] = useState('')
    const pickerOverlayPanel = useRef<OverlayPanel>(null)

    const populateParameter = useCallback(() => {
      if (queryParameters[snakeCaseName]) {
        setUserValue(queryParameters[snakeCaseName].userValue)
        setOrgDefaultValue(queryParameters[snakeCaseName].orgDefaultValue)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        formQueryParametersScaffold([snakeCaseName], queryParameters)
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

    return (
      <div
        id={snakeCaseName + '-field-container'}
        className={styles.query_parameter}
      >
        <span>
          <b>
            <label htmlFor={snakeCaseName + '-field'}>{titleCaseName}</label>
          </b>
          <EditText
            id={snakeCaseName + '-field'}
            value={userValue}
            onEditMode={() => {
              pickerOverlayPanel.current?.show(
                {} as OverlayPanelEventType,
                document.getElementById(snakeCaseName + '-field-container')
              )
            }}
            onChange={(e) => {
              setUserValue(e.target.value)
            }}
            onSave={({ value }) => {
              setParameter(value)
            }}
            style={{ width: '200px', border: '1px solid #ccc' }}
          />
        </span>
        {picker && (
          <OverlayPanel
            id={snakeCaseName + '-picker-overlay'}
            ref={pickerOverlayPanel}
          >
            {picker === 'date' && (
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
            )}
            {picker === 'frequency' && (
              <ListBox
                id={snakeCaseName + '-frequency-dropdown'}
                options={[
                  { label: 'SECOND', value: 'SECOND' },
                  { label: 'MINUTE', value: 'MINUTE' },
                  { label: 'HOUR', value: 'HOUR' },
                  { label: 'DAY', value: 'DAY' },
                  { label: 'WEEK', value: 'WEEK' },
                  { label: 'MONTH', value: 'MONTH' },
                  { label: 'QUARTER', value: 'QUARTER' },
                  { label: 'YEAR', value: 'YEAR' },
                ]}
                onChange={(e) => {
                  setParameter(e.value)
                }}
                style={{ border: '0px' }}
              />
            )}
          </OverlayPanel>
        )}
        {!(userValue === orgDefaultValue) ? (
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
            {userIsAdmin ? (
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
            ) : null}
          </>
        ) : null}
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
          <QueryParameterField titleCaseName="Beginning Date" picker="date" />
          <QueryParameterField titleCaseName="Ending Date" picker="date" />
          <QueryParameterField titleCaseName="Frequency" picker="frequency" />
          <QueryParameterField titleCaseName="Group By" />
          <QueryParameterField titleCaseName="Conditions" />
          <QueryParameterField titleCaseName="Show Unfinished Values" />
        </OverlayPanel>
      </div>
    )
  }
}

const ControlPanel = React.memo(_ControlPanel)
export default ControlPanel
