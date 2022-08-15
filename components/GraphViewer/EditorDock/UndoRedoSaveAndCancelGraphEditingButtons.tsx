import { Button } from 'primereact/button'
import { FunctionComponent, useCallback } from 'react'

import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'

type UndoRedoSaveAndCancelGraphEditingButtonsProps = {}
const UndoRedoSaveAndCancelGraphEditingButtons: FunctionComponent<UndoRedoSaveAndCancelGraphEditingButtonsProps> = () => {  
  const { disableEditing } = useEditability()
  const { undo, redo, canUndo, canRedo, loadGraph, saveGraph } = useGraph()

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

  return (
    <>
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
    </>
  )
}

export default UndoRedoSaveAndCancelGraphEditingButtons