import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, { FunctionComponent, useCallback, useState } from 'react'

import FormulaEditor from './FormulaEditor'
import UndoRedoSaveAndCancelGraphEditingButtons from './UndoRedoSaveAndCancelGraphEditingButtons'
import styles from '../../../styles/EditorDock.module.css'
import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'

type EditorDockProps = {}
const _EditorDock: FunctionComponent<EditorDockProps> = () => {
  const { editingEnabled } = useEditability()
  const { graph, updateGraph, formMetricNode } = useGraph()
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
              <UndoRedoSaveAndCancelGraphEditingButtons />
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
