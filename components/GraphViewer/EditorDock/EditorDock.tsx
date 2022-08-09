import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, { FunctionComponent, useCallback, useState } from 'react'

import FormulaEditor from './FormulaEditor'
import styles from '../../../styles/EditorDock.module.css'
import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'

type EditorDockProps = {}
const _EditorDock: FunctionComponent<EditorDockProps> = () => {
  const { editingEnabled, disableEditing } = useEditability()
  const { graph, loadGraph, undo, redo, canUndo, canRedo, saveGraph, updateGraph, formMetricNode } = useGraph()
  const [showFormulaEditor, setShowFormulaEditor] = useState(false)

  const onFunctionAddition = useCallback(() => {
    setShowFormulaEditor(true)
  }, [])

  const addMetricNode = useCallback(() => {
    if (!formMetricNode) {
      throw new Error('formMetricNode is not defined')
    }
    if (!updateGraph) {
      throw new Error('updateGraph is not defined')
    }
    const newNode = formMetricNode()
    if (newNode) {
      updateGraph('nodes', graph.nodes.concat(newNode), true)
    }
  }, [formMetricNode, updateGraph, graph.nodes])

  const onCancel = useCallback(() => {
    if (!loadGraph) {
      throw new Error('loadGraph is not defined')
    }
    loadGraph()
    disableEditing()
  }, [loadGraph, disableEditing])

  const onSave = useCallback(() => {
    if (!saveGraph) {
      throw new Error('saveGraph is not defined')
    }
    if (!loadGraph) {
      throw new Error('loadGraph is not defined')
    }
    saveGraph().then((response) => {
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
        {showFormulaEditor ? (
          <FormulaEditor setShowFormulaEditor={setShowFormulaEditor} />
        ) : (
          <Toolbar
            className={styles.editor_toolbar}
            left={
              <div>
                <Button
                  label="+ Metric"
                  onClick={addMetricNode}
                  disabled={!formMetricNode || !updateGraph}
                />
                <Button label="+ Function" onClick={onFunctionAddition} />
              </div>
            }
            right={
              <div>
                <Button
                  className="p-button-outlined"
                  icon="pi pi-undo"
                  onClick={undo}
                  disabled={!canUndo}
                />
                <Button
                  className="p-button-outlined"
                  icon="pi pi-refresh"
                  onClick={redo}
                  disabled={!canRedo}
                />
                <Button
                  label="Save"
                  onClick={onSave}
                  disabled={!saveGraph || !loadGraph}
                />
                <Button
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={onCancel}
                  disabled={!loadGraph}
                />
              </div>
            }
          />
        )}
      </div>
    )
  } else {
    return null
  }
}

const EditorDock = React.memo(_EditorDock)
export default EditorDock
