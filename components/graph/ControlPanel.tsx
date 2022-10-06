import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
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
import styles from '../../styles/ControlPanel.module.css'
import { analytics } from '../../utils/segmentClient'

type ControlPanelProps = {
  hideEditButton?: boolean
}
const _ControlPanel: FunctionComponent<ControlPanelProps> = ({
  hideEditButton,
}) => {
  const { userCanEdit, userIsAdmin } = useAuth()
  const { editingEnabled, enableEditing } = useEditability()
  const showEditButton = userCanEdit && !hideEditButton
  const {
    globalQueryRefreshes,
    setGlobalQueryRefreshes,
    queriesLoading,
    queryParameters,
    initializeQueryParameter,
    resetQueryParameterUserValue,
    setQueryParameterUserValue,
    setQueryParameterOrgDefaultValue,
  } = useGraph()

  type QueryParameterFieldProps = {
    titleCaseName: string
  }
  const QueryParameterField: FunctionComponent<QueryParameterFieldProps> = ({
    titleCaseName,
  }) => {
    const snakeCaseName = titleCaseName.toLowerCase().replace(/ /g, '_')
    const [userValue, setUserValue] = useState('')
    const [orgDefaultValue, setOrgDefaultValue] = useState('')

    const populateParameter = useCallback(() => {
      if (queryParameters[snakeCaseName]) {
        setUserValue(queryParameters[snakeCaseName].userValue)
        setOrgDefaultValue(queryParameters[snakeCaseName].orgDefaultValue)
      } else {
        initializeQueryParameter!(snakeCaseName)
      }
    }, [snakeCaseName])
    useEffect(() => {
      populateParameter()
    }, [populateParameter])

    return (
      <div className={styles.query_parameter}>
        <span>
          <b>
            <label htmlFor={snakeCaseName + '-field'}>{titleCaseName}</label>
          </b>
          <EditText
            id={snakeCaseName + '-field'}
            value={userValue}
            onChange={(e) => {
              setUserValue(e.target.value)
            }}
            onSave={({ value }) => {
              analytics.track('set_query_parameter', {
                parameter: snakeCaseName,
                value: value,
              })
              setQueryParameterUserValue!(snakeCaseName, value)
            }}
            style={{ width: '200px', border: '1px solid #ccc' }}
          />
        </span>
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
                  setQueryParameterOrgDefaultValue!(snakeCaseName, userValue)
                }}
              />
            ) : null}
          </>
        ) : null}
      </div>
    )
  }

  const overlayPanel = useRef<OverlayPanel>(null)

  if (editingEnabled) {
    return null
  } else {
    return (
      <div className={styles.control_panel}>
        {queriesLoading.length > 0 ? (
          <Button
            id="graph-loading-indicator-button"
            className={styles.button}
            icon="pi pi-refresh"
            loading
          />
        ) : (
          <>
            <Button
              id="query-settings-button"
              className={styles.button}
              icon="pi pi-sliders-h"
              onClick={(event) => {
                analytics.track('view_query_settings')
                overlayPanel.current?.toggle(event)
              }}
            />
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
        )}
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
        <OverlayPanel id="query-parameters-overlay" ref={overlayPanel}>
          <QueryParameterField titleCaseName="Beginning Date" />
          <QueryParameterField titleCaseName="Ending Date" />
          <QueryParameterField titleCaseName="Frequency" />
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
