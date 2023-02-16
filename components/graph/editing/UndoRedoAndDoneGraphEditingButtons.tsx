import { Button } from 'primereact/button'
import { FunctionComponent } from 'react'

import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import { analytics } from 'utils/segmentClient'

const UndoRedoAndDoneGraphEditingButtons: FunctionComponent = () => {
  const { disableEditing } = useEditability()
  const { undo, redo, canUndo, canRedo, loadGraph } = useGraph()

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
        id="done-button"
        label="Done"
        onClick={() => {
          analytics.track('done_editing')
          disableEditing()
          loadGraph?.() // clear undo/redo history
        }}
      />
    </>
  )
}

export default UndoRedoAndDoneGraphEditingButtons
