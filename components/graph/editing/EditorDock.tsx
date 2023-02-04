import { Button } from 'primereact/button'
import { InputSwitch } from 'primereact/inputswitch'
import { InputText } from 'primereact/inputtext'
import { ListBox } from 'primereact/listbox'
import { OverlayPanel } from 'primereact/overlaypanel'
import { Toolbar } from 'primereact/toolbar'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { useEditability } from '../../../contexts/editability'
import { useGraph } from '../../../contexts/graph'
import styles from '../../../styles/EditorDock.module.css'
import { analytics } from '../../../utils/segmentClient'
import FormulaEditor from './FormulaEditor'
import UndoRedoSaveAndCancelGraphEditingButtons from './UndoRedoSaveAndCancelGraphEditingButtons'

type EditorDockProps = {
  parent: 'GraphViewer' | 'GraphTable'
}
const _EditorDock: FunctionComponent<EditorDockProps> = ({ parent }) => {
  const { editingEnabled } = useEditability()
  const { graph, updateGraph, formMetricNode, formMissionNode } = useGraph()
  const [showFormulaEditor, setShowFormulaEditor] = useState(false)

  const newNodeMenuOverlayPanel = useRef<OverlayPanel>(null)

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
      updateGraph(
        { nodes: graph.nodes.concat(newNode), edges: undefined },
        true
      )
    }
  }, [formMetricNode, updateGraph, graph.nodes])

  const onFormulaAddition = useCallback(() => {
    analytics.track('add_formula')
    setShowFormulaEditor(true)
  }, [])

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
      updateGraph(
        { nodes: graph.nodes.concat(newNode), edges: undefined },
        true
      )
    }
  }, [formMissionNode, updateGraph, graph.nodes])
  const deleteMissionNode = useCallback(() => {
    if (!updateGraph) {
      throw new Error('updateGraph is not defined')
    }
    const newNodes = graph.nodes.filter((node) => node.type !== 'mission')
    analytics.track('delete_mission_node')
    updateGraph({ nodes: newNodes, edges: undefined }, true)
  }, [updateGraph, graph.nodes])

  const [tablePositionFieldValue, setTablePositionFieldValue] = useState('')
  useEffect(() => {
    setTablePositionFieldValue(
      graph.nodes
        .filter((node) => node.type === 'metric' && node.data.tablePosition)
        .map((node) => node.id)
        .join(',')
    )
  }, [graph.nodes])
  const processNewTablePositionFieldValue = useCallback(
    (newTablePositionFieldValue: string) => {
      if (!updateGraph) {
        throw new Error('updateGraph is not defined')
      }
      const metricIds = newTablePositionFieldValue
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '')
      const newNodes = graph.nodes.map((node) => {
        if (node.type === 'metric') {
          const index = metricIds.indexOf(node.id) + 1 || null
          return {
            ...node,
            data: {
              ...node.data,
              tablePosition: index,
            },
          }
        } else {
          return node
        }
      })
      analytics.track('set_table_positions')
      updateGraph({ nodes: newNodes, edges: undefined }, true)
    },
    [updateGraph, graph.nodes]
  )

  if (editingEnabled) {
    return (
      <div className={styles.editor_dock}>
        {showFormulaEditor ? (
          <FormulaEditor setShowFormulaEditor={setShowFormulaEditor} />
        ) : (
          <Toolbar
            className={styles.editor_toolbar}
            left={
              parent === 'GraphViewer' ? (
                <>
                  <Button
                    id="add-node-button"
                    label="+ Node"
                    onClick={(e) => newNodeMenuOverlayPanel.current?.toggle(e)}
                    disabled={!formMetricNode || !updateGraph}
                  />
                  <style jsx>
                    {`
                      .p-overlaypanel-content {
                        padding: 0 !important;
                      }
                    `}
                  </style>
                  <OverlayPanel
                    ref={newNodeMenuOverlayPanel}
                    showCloseIcon={false}
                  >
                    <ListBox
                      value={null}
                      options={[
                        {
                          label: '+ Metric Node',
                          value: 'metric',
                        },
                        {
                          label: '+ Custom Node',
                          value: 'custom',
                        },
                      ]}
                      onChange={(e) => {
                        if (e.value === 'metric') {
                          addMetricNode()
                        } else if (e.value === 'custom') {
                          // TODO
                        }
                        newNodeMenuOverlayPanel.current?.hide()
                      }}
                      style={{ border: 'none', fontWeight: 'bold' }}
                    />
                  </OverlayPanel>
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
              ) : (
                <>
                  <>
                    <label htmlFor="table-position-field">
                      Top-level Metrics:
                    </label>
                    <InputText
                      id="table-position-field"
                      className={styles.table_position_field}
                      value={tablePositionFieldValue}
                      onChange={(e) => {
                        const newTablePositionFieldValue = e.target.value
                        setTablePositionFieldValue(newTablePositionFieldValue)
                      }}
                      onBlur={() => {
                        processNewTablePositionFieldValue(
                          tablePositionFieldValue
                        )
                      }}
                      tooltip="Enter a comma-separated list of metric IDs to show as the table's top-level metrics, or leave blank for smart ordering."
                    />
                  </>
                </>
              )
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
