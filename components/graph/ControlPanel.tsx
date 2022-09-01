import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'
import { EditText } from 'react-edit-text'
import { v4 as uuidv4 } from 'uuid'

import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/ControlPanel.module.css'
import { analytics } from '../../utils/segmentClient'
import { supabase } from '../../utils/supabaseClient'

type ControlPanelProps = {}
const _ControlPanel: FunctionComponent<ControlPanelProps> = () => {
  const { userCanEdit, userIsAdmin, organizationId, session } = useAuth()
  const { editingEnabled, enableEditing } = useEditability()
  const { globalQueryRefreshes, setGlobalQueryRefreshes } = useGraph()

  type QueryParameterFieldProps = {
    titleCaseName: string
  }
  const QueryParameterField: FunctionComponent<QueryParameterFieldProps> = ({ titleCaseName }) => {
    const snakeCaseName = titleCaseName.toLowerCase().replace(/ /g, '_')
    const [userRecordId, setUserRecordId] = useState(uuidv4()) // initial to enable upsert; overwritten by populate if record exists
    const [userValue, setUserValue] = useState('')
    const [orgDefaultRecordId, setOrgDefaultRecordId] = useState(uuidv4())
    const [orgDefaultValue, setOrgDefaultValue] = useState('')
    const [orgDefaultValueInUse, setOrgDefaultValueInUse] = useState(true)

    async function populateParameter() {
      try {
        let { data, error, status } = await supabase
          .from('database_query_parameters')
          .select('id, user_id, name, value, deleted_at')
          .eq('name', snakeCaseName)
          // rls limits to records from user's org where user_id is user's or null

        if (error && status !== 406) {
          throw error
        }

        if (data && data.length > 0) {
          const userRecord = data.find(record => record.user_id === session?.user?.id)
          const defaultRecord = data.find(record => record.user_id === null)
          if (userRecord) {
            setUserRecordId(userRecord.id)
            if (userRecord.deleted_at === null) {
              setUserValue(userRecord.value)
              setOrgDefaultValueInUse(false)
            }
          }
          if (defaultRecord) {
            setOrgDefaultRecordId(defaultRecord.id)
            if (defaultRecord.deleted_at === null) {
              setOrgDefaultValue(defaultRecord.value)
              if (!userRecord || userRecord.deleted_at !== null) {
                setUserValue(defaultRecord.value)
              }
            }
          }
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
    useEffect(() => {
      populateParameter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function saveParameter(id: string, value: string, isDefault: boolean) {
      try {
        await supabase
          .from('database_query_parameters')
          .upsert({
            id: id,
            organization_id: organizationId,
            user_id: isDefault ? null : session?.user?.id,
            name: snakeCaseName,
            value: value,
            updated_at: new Date(),
            deleted_at: null,
          })
      } catch (error: any) {
        alert(error.message)
      }
    }

    async function deleteParameter(id: string, isDefault: boolean) {
        try {
          await supabase
            .from('database_query_parameters')
            .upsert({
              id: id,
              organization_id: organizationId,
              user_id: isDefault ? null : session?.user?.id,
              name: snakeCaseName,
              value: null,
              updated_at: new Date(),
              deleted_at: new Date(),
            })
        } catch (error: any) {
          alert(error.message)
        }
      }

    return (
      <div className={styles.query_parameter}>
        <span>
          <b><label htmlFor={snakeCaseName + '-field'}>{titleCaseName}</label></b>
          <EditText
            id={snakeCaseName + '-field'}
            value={userValue}
            onChange={(e) => {
              setUserValue(e.target.value)
              if (e.target.value !== orgDefaultValue) {
                setOrgDefaultValueInUse(false)
              } else {
                setOrgDefaultValueInUse(true)
              }
            }}
            onSave={({ value }) => {
              if (!orgDefaultValueInUse) {
                saveParameter(userRecordId, value, false)
              } else {
                deleteParameter(userRecordId, false)
              }
            }}
            style={{ width: '200px', border: '1px solid #ccc' }}
          />
        </span>
        {!orgDefaultValueInUse ? (
          <>
            <Button
              label="Reset"
              className="p-button-rounded p-button-text p-button-sm"
              onClick={() => {
                setUserValue(orgDefaultValue)
                setOrgDefaultValueInUse(true)
                deleteParameter(userRecordId, false)
              }}
            />
            {userIsAdmin ? (
              <Button
                label="Set Default"
                className="p-button-rounded p-button-text p-button-sm"
                onClick={() => {
                  setOrgDefaultValue(userValue)
                  setOrgDefaultValueInUse(true)
                  saveParameter(orgDefaultRecordId, userValue, true)
                  deleteParameter(userRecordId, false)
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
        <Button
          id="query-settings-button"
          className={styles.button}
          icon="pi pi-cog"
          onClick={(event) => {
            overlayPanel.current?.toggle(event)
          }}
        />
        <Button
          id="global-query-refresh-button"
          className={styles.button}
          icon="pi pi-refresh"
          onClick={() => {
            if (setGlobalQueryRefreshes) {
              setGlobalQueryRefreshes(globalQueryRefreshes + 1)
            }
          }}
        />
        {userCanEdit ? (
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
          ref={overlayPanel}
          >
            <QueryParameterField titleCaseName='Beginning Date' />
            <QueryParameterField titleCaseName='Ending Date' />
            <QueryParameterField titleCaseName='Frequency' />
            <QueryParameterField titleCaseName='Group By' />
        </OverlayPanel>
      </div>
    )
  }
}

const ControlPanel = React.memo(_ControlPanel)
export default ControlPanel
