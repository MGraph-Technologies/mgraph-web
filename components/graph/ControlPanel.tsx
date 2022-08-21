import { Button } from 'primereact/button'
import React, { FunctionComponent } from 'react'

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/ControlPanel.module.css'
import { analytics } from '../../utils/segmentClient'

type ControlPanelProps = {}
const _ControlPanel: FunctionComponent<ControlPanelProps> = () => {
  const userCanEdit = true // TODO: get this from db
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
        <Button
          id="edit-button"
          className={styles.button}
          icon="pi pi-pencil"
          disabled={!userCanEdit}
          onClick={() => {
            analytics.track('enable_editing')
            enableEditing()
          }}
        />
      </div>
    )
  }
}

const ControlPanel = React.memo(_ControlPanel)
export default ControlPanel
