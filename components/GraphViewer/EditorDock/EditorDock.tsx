import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, { FunctionComponent, useCallback, useState } from 'react'

import FormulaField from './FormulaField'
import styles from '../../../styles/EditorDock.module.css'
import { Graph } from '../GraphViewer'

type EditorDockProps = {
  editingEnabled: boolean,
  graph: Graph,
  onCancel: () => void,
  onSave: () => Promise<void>,
  onMetricAddition: () => void,
}
const _EditorDock: FunctionComponent<EditorDockProps> = ({
  editingEnabled,
  graph,
  onCancel,
  onSave,
  onMetricAddition,
}) => {
  const [showFormulaEditor, setShowFormulaEditor] = useState(false)
  const onFormulaAddition = useCallback(() => {
    setShowFormulaEditor(true)
  }, [])
  const FormulaEditor: FunctionComponent = () => {
    if (showFormulaEditor) {
      return <div>
          <FormulaField graph={graph}/>
          <Button icon="pi pi-check"/>
          <Button icon="pi pi-times" onClick={(e) => setShowFormulaEditor(false)}/>
        </div>
    } else {
      return null
    }
  }

  if (editingEnabled) {
    return (
      <div className={styles.editor_dock}>
        <FormulaEditor/>
        <Toolbar
          className={styles.editor_toolbar}
          left={
            <div>
              <Button label="+ Metric" onClick={onMetricAddition} />
              <Button label="+ Formula" onClick={onFormulaAddition} />
            </div>
          }
          right={
            <div>
              <Button label="Save" onClick={onSave} />
              <Button
                className="p-button-outlined"
                label="Cancel"
                onClick={onCancel}
              />
            </div>
          }
        />
      </div>
    )
  } else {
    return null
  }
}

const EditorDock = React.memo(_EditorDock)
export default EditorDock