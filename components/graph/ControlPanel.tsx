import { Button } from 'primereact/button'
import React, { FunctionComponent } from 'react'

import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import styles from '../../styles/ControlPanel.module.css'
import { analytics } from '../../utils/segmentClient'

type ControlPanelProps = {}
const _ControlPanel: FunctionComponent<ControlPanelProps> = () => {
  const { userCanEdit } = useAuth()
  const { editingEnabled, enableEditing } = useEditability()
  if (editingEnabled) {
    return null
  } else {
    return (
      <div className={styles.control_panel}>
        <Button
          id="date-range-button"
          className={styles.button}
          icon="pi pi-calendar"
          disabled={true} // TODO: activate
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
      </div>
    )
  }
}

const ControlPanel = React.memo(_ControlPanel)
export default ControlPanel
