import { Button } from 'primereact/button'
import { InputSwitch } from 'primereact/inputswitch'
import { Toolbar } from 'primereact/toolbar'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'

import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'
import styles from '../../../styles/EditorDock.module.css'
import { analytics } from '../../../utils/segmentClient'
import FormulaEditor from './FormulaEditor'
import UndoRedoSaveAndCancelGraphEditingButtons from './UndoRedoSaveAndCancelGraphEditingButtons'

type EditorDockProps = {}
const _EditorDock: FunctionComponent<EditorDockProps> = () => {
  const { editingEnabled } = useEditability()
  const { graph, updateGraph, formMetricNode, formMissionNode } = useGraph()
  const [showFormulaEditor, setShowFormulaEditor] = useState(false)

  const onFormulaAddition = useCallback(() => {
    analytics.track('add_formula')
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
      analytics.track('add_metric_node')
      updateGraph('nodes', graph.nodes.concat(newNode), true)
    }
  }, [formMetricNode, updateGraph, graph.nodes])

  const [missionToggleChecked, setMissionToggleChecked] = useState(false)
  useEffect(() => {
    setMissionToggleChecked(graph.nodes.some((node) => node.type === 'mission'))
  }, [graph.nodes])
  const addMissionNode = useCallback(() => {
    if (!formMissionNode) {
      throw new Error('formMetricNode is not defined')
    }
    if (!updateGraph) {
      throw new Error('updateGraph is not defined')
    }
    const newNode = formMissionNode()
    if (newNode) {
      analytics.track('add_mission_node')
      updateGraph('nodes', graph.nodes.concat(newNode), true)
    }
  }, [formMissionNode, updateGraph, graph.nodes])
  const deleteMissionNode = useCallback(() => {
    if (!updateGraph) {
      throw new Error('updateGraph is not defined')
    }
    const newNodes = graph.nodes.filter((node) => node.type !== 'mission')
    analytics.track('delete_mission_node')
    updateGraph('nodes', newNodes, true)
  }, [updateGraph, graph.nodes])

  if (editingEnabled) {
    return (
      <div className={styles.editor_dock}>
        {showFormulaEditor ? (
          <FormulaEditor setShowFormulaEditor={setShowFormulaEditor} />
        ) : (
          <Toolbar
            className={styles.editor_toolbar}
            left={
              <>
                <Button
                  id="add-metric-button"
                  label="+ Metric"
                  onClick={addMetricNode}
                  disabled={!formMetricNode || !updateGraph}
                />
                <Button
                  id="add-formula-button"
                  label="+ Formula"
                  onClick={onFormulaAddition}
                />
                <label
                  htmlFor="add-mission-toggle"
                  className={styles.toggle_label}
                >
                  Show Mission
                </label>
                <InputSwitch
                  id="add-mission-toggle"
                  className={styles.toggle}
                  checked={missionToggleChecked}
                  onChange={(e) => {
                    if (e.value) {
                      addMissionNode()
                    } else {
                      deleteMissionNode()
                    }
                  }}
                />
              </>
            }
            right={<UndoRedoSaveAndCancelGraphEditingButtons />}
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
