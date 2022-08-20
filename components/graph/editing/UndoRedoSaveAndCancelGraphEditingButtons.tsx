import { Button } from 'primereact/button'
import { FunctionComponent, useCallback } from 'react'

import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'
import { analytics } from '../../../utils/segmentClient'

type UndoRedoSaveAndCancelGraphEditingButtonsProps = {}
const UndoRedoSaveAndCancelGraphEditingButtons: FunctionComponent<
  UndoRedoSaveAndCancelGraphEditingButtonsProps
> = () => {
  const { disableEditing } = useEditability()
  const { undo, redo, canUndo, canRedo, loadGraph, saveGraph } = useGraph()

  const onCancel = useCallback(() => {
    if (!loadGraph) {
      throw new Error('loadGraph is not defined')
    }
    analytics.track('cancel_editing')
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
        analytics.track('save_editing')
        disableEditing()
        loadGraph()
      } else {
        analytics.track('save_editing_error', {
          status_text: response?.statusText,
        })
        console.error(response)
      }
    })
  }, [saveGraph, disableEditing, loadGraph])

  return (
    <>
      <Button
        id="undo-button"
        className="p-button-outlined"
        icon="pi pi-undo"
        onClick={() => {
          if (undo) {
            analytics.track('undo')
            undo()
          }
        }}
        disabled={!canUndo}
      />
      <Button
        id="redo-button"
        className="p-button-outlined"
        icon="pi pi-refresh"
        onClick={() => {
          if (redo) {
            analytics.track('redo')
            redo()
          }
        }}
        disabled={!canRedo}
      />
      <Button
        id="save-button"
        label="Save"
        onClick={onSave}
        disabled={!saveGraph || !loadGraph}
      />
      <Button
        id="cancel-button"
        className="p-button-outlined"
        label="Cancel"
        onClick={onCancel}
        disabled={!loadGraph}
      />
    </>
  )
}

export default UndoRedoSaveAndCancelGraphEditingButtons
