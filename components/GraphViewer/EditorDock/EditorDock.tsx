import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, { FunctionComponent, useCallback, useState } from 'react'

import FormulaField from './FormulaField'
import styles from '../../../styles/EditorDock.module.css'
import { useEditability } from '../../../contexts/editability'
import { Graph } from '../GraphViewer'

type EditorDockProps = {
  graph: Graph,
  loadGraph: () => void,
  saveGraph: () => Promise<Response | undefined>,
  addMetricNode: () => void,
  // add edges tba
}
const _EditorDock: FunctionComponent<EditorDockProps> = ({
  graph,
  loadGraph,
  saveGraph,
  addMetricNode,
}) => {
  const { editingEnabled, disableEditing } = useEditability()
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

  const onCancel = useCallback(() => {
    loadGraph()
    disableEditing()
  }, [])
  const onSave = useCallback(() => {
    saveGraph()
    .then((response) => {
      if (response?.status === 200) {
        // only reset if the save was successful
        disableEditing()
        loadGraph()
      } else {
        console.error(response)
      }
    })
  }, [saveGraph, disableEditing, loadGraph])

  if (editingEnabled) {
    return (
      <div className={styles.editor_dock}>
        <FormulaEditor/>
        <Toolbar
          className={styles.editor_toolbar}
          left={
            <div>
              <Button label="+ Metric" onClick={addMetricNode} />
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