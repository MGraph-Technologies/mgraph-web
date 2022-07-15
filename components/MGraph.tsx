import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import ReactFlow, {
  Connection,
  Controls,
  Edge,
  EdgeChange,
  MiniMap,
  Node,
  NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from 'react-flow-renderer'
import useUndoable from 'use-undoable'

import { useEditability } from '../contexts/editability'
import styles from '../styles/MGraph.module.css'

const flowKey = 'example-flow' // TODO: load flow from db
const userCanEdit = true // TODO: get this from db

type MGraphProps = {}
const MGraph: FunctionComponent<MGraphProps> = () => {
  const initialNodes: Node[] = []
  const initialEdges: Edge[] = []
  const [elements, setElements, { undo, redo, canUndo, canRedo, reset }] =
    useUndoable(
      {
        nodes: initialNodes,
        edges: initialEdges,
      },
      { behavior: 'destroyFuture' }
    )
  const { editingEnabled, enableEditing, disableEditing } = useEditability()
  const [undoableLoggingEnabled, setUndoableLoggingEnabled] = useState(true)
  const { project } = useReactFlow()

  const updateElements = useCallback(
    (t: 'nodes' | 'edges', v: Array<any>) => {
      // To prevent a mismatch of state updates,
      // we'll use the value passed into this
      // function instead of the state directly.
      setElements(
        (e) => ({
          nodes: t === 'nodes' ? v : e.nodes,
          edges: t === 'edges' ? v : e.edges,
        }),
        undefined,
        !undoableLoggingEnabled
      )
    },
    [setElements, undoableLoggingEnabled]
  )

  const loadFlow = useCallback(() => {
    const flowStr = localStorage.getItem(flowKey) || ''
    if (flowStr) {
      const flow = JSON.parse(flowStr)
      reset({ nodes: flow.nodes, edges: flow.edges })
    }
  }, [reset])

  useEffect(() => {
    loadFlow()
  }, [loadFlow])

  const saveFlow = useCallback(() => {
    localStorage.setItem(flowKey, JSON.stringify(elements))
    reset({ nodes: elements.nodes, edges: elements.edges })
  }, [elements, reset])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      updateElements('nodes', applyNodeChanges(changes, elements.nodes))
    },
    [updateElements, elements.nodes]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      updateElements('edges', applyEdgeChanges(changes, elements.edges))
    },
    [updateElements, elements.edges]
  )

  const onNodeDragStart = useCallback(() => {
    setUndoableLoggingEnabled(false)
  }, [setUndoableLoggingEnabled])

  const onNodeDragStop = useCallback(() => {
    setUndoableLoggingEnabled(true)
  }, [setUndoableLoggingEnabled])

  const onAdd = useCallback(() => {
    const { x, y } = project({
      x: self.innerWidth / 4,
      y: self.innerHeight - 250,
    })
    const newNode = {
      id: `randomnode_${+new Date()}`,
      data: { label: 'Added node' },
      position: {
        x: x,
        y: y,
      },
    }
    updateElements('nodes', elements.nodes.concat(newNode))
  }, [project, updateElements, elements.nodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      updateElements('edges', addEdge(connection, elements.edges))
    },
    [updateElements, elements.edges]
  )

  const ControlPanel: FunctionComponent = () => {
    if (editingEnabled) {
      return null
    } else {
      return (
        <div className={styles.control_panel}>
          <Button
            icon="pi pi-calendar"
            disabled={true} // TODO: activate
          />
          <Button
            icon="pi pi-history"
            disabled={true} // TODO: activate
          />
          <Button
            icon="pi pi-pencil"
            disabled={!userCanEdit}
            onClick={enableEditing}
          />
        </div>
      )
    }
  }

  const EditorDock: FunctionComponent = () => {
    const saveEditing = useCallback(() => {
      saveFlow()
      disableEditing()
    }, [])

    const cancelEditing = useCallback(() => {
      loadFlow()
      disableEditing()
    }, [])

    if (editingEnabled) {
      return (
        <div className={styles.editor_dock}>
          <Toolbar
            className={styles.editor_toolbar}
            left={
              <div>
                <Button icon="pi pi-plus" onClick={onAdd} />
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
                <Button label="Save" onClick={() => saveEditing()} />
                <Button
                  className="p-button-outlined"
                  label="Cancel"
                  onClick={() => cancelEditing()}
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

  return (
    <div className={styles.mgraph}>
      <ReactFlow
        nodes={elements.nodes}
        edges={elements.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        elementsSelectable={editingEnabled}
        nodesDraggable={editingEnabled}
        nodesConnectable={editingEnabled}
        panOnScroll={true}
      >
        <ControlPanel />
        <Controls showInteractive={false} />
        <EditorDock />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default MGraph
