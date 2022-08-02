import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, { FunctionComponent, useCallback, useState } from 'react'
import { Node } from 'react-flow-renderer'

import FormulaEditor from './FormulaEditor'
import styles from '../../../styles/EditorDock.module.css'
import { useEditability } from '../../../contexts/editability'
import { Graph } from '../GraphViewer'

type EditorDockProps = {
  graph: Graph
  loadGraph: () => void
  saveGraph: () => Promise<Response | undefined>
  updateGraph: (t: 'nodes' | 'edges', v: Array<any>, undoable: boolean) => void
  formMetricNode: () => Node<any>
  formFunctionNode: (newNodeId: string, functionTypeId: string, inputNodeId: string, outputNodeId: string) => Node<any>
  canUndo: boolean
  undo: () => void
  canRedo: boolean
  redo: () => void
  // add edges tba
}
const _EditorDock: FunctionComponent<EditorDockProps> = ({
  graph,
  loadGraph,
  saveGraph,
  updateGraph,
  formMetricNode,
  formFunctionNode,
  canUndo,
  undo,
  canRedo,
  redo,
}) => {
  const { editingEnabled, disableEditing } = useEditability()
  const [showFormulaEditor, setShowFormulaEditor] = useState(false)

  const onFunctionAddition = useCallback(() => {
    setShowFormulaEditor(true)
  }, [])

  const addMetricNode = useCallback(() => {
    const newNode = formMetricNode()
    if (newNode) {
      updateGraph('nodes', graph.nodes.concat(newNode), true)
    }
  }, [formMetricNode, updateGraph, graph.nodes])

  const onCancel = useCallback(() => {
    loadGraph()
    disableEditing()
  }, [loadGraph, disableEditing])
  
  const onSave = useCallback(() => {
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
          <FormulaEditor
            graph={graph}
            updateGraph={updateGraph}
            formFunctionNode={formFunctionNode}
            setShowFormulaEditor={setShowFormulaEditor}
            />
        ) : (
          <Toolbar
            className={styles.editor_toolbar}
            left={
              <div>
                <Button label="+ Metric" onClick={addMetricNode} />
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
                <Button label="Save" onClick={onSave} />
                <Button
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={onCancel}
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
