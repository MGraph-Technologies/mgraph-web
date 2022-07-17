import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
import React, {
  FunctionComponent,
  MouseEvent as ReactMouseEvent,
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

import MetricNode, { MetricNodeDataType } from '../components/MetricNode'
import { useEditability } from '../contexts/editability'
import styles from '../styles/MGraph.module.css'

const flowKey = 'example-flow' // TODO: load flow from db
const userCanEdit = true // TODO: get this from db

const nodeTypes = { metric: MetricNode }

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
      { behavior: 'destroyFuture', ignoreIdenticalMutations: false }
    )
  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      const actionKey = navigator.platform.match(/Mac/i) ? e.metaKey : e.ctrlKey
      if (actionKey && !e.shiftKey && e.key === 'z') {
        undo()
      }
      if (actionKey && e.shiftKey && e.key === 'z') {
        redo()
      }
    }
    document.addEventListener('keydown', keyDownHandler)
    // clean up
    return () => {
      document.removeEventListener("keydown", keyDownHandler);
    }
  }, [undo, redo])
  const { editingEnabled, enableEditing, disableEditing } = useEditability()
  const { project } = useReactFlow()

  const updateElements = useCallback(
    (t: 'nodes' | 'edges', v: Array<any>, undoable: boolean) => {
      // To prevent a mismatch of state updates,
      // we'll use the value passed into this
      // function instead of the state directly.
      setElements(
        (e) => ({
          nodes: t === 'nodes' ? v : e.nodes,
          edges: t === 'edges' ? v : e.edges,
        }),
        undefined,
        !undoable
      )
    },
    [setElements]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      updateElements('nodes', applyNodeChanges(changes, elements.nodes), false)
    },
    [updateElements, elements.nodes]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      updateElements('edges', applyEdgeChanges(changes, elements.edges), true)
    },
    [updateElements, elements.edges]
  )

  const onNodeDragStart = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      updateElements(
        'nodes', 
        elements.nodes.map(
          (n) => n.id === node.id ? node : n
        ),
        true
      )
  }, [updateElements, elements])
  
  /* ideally we'd use a callback for this, but I don't think it's currently possible
  https://github.com/wbkd/react-flow/discussions/2270 */
  const [nodeDataToChange, setNodeDatatoChange] = useState<MetricNodeDataType>()
  useEffect(() => {
    if (nodeDataToChange) {
      const nodeId = nodeDataToChange.nodeId
      const node = elements.nodes.find((n) => n.id === nodeId)
      const otherNodes = elements.nodes.filter((n) => n.id !== nodeId)
      if (node) {
        let nodeClone = JSON.parse(JSON.stringify(node)) // so updateElements detects a change
        nodeClone.data = nodeDataToChange
        updateElements('nodes', otherNodes.concat(nodeClone), true)
      }
      setNodeDatatoChange(undefined) // avoid infinite loop
    }
  }, [nodeDataToChange, setNodeDatatoChange, updateElements, elements.nodes])

  const onAdd = useCallback(() => {
    const { x, y } = project({
      x: self.innerWidth / 4,
      y: self.innerHeight - 250,
    })
    const nodeId = `randomnode_${+new Date()}`
    const newNodeData: MetricNodeDataType = {
      nodeId: nodeId, // needed for setNodeDataToChange
      name: 'New Metric',
      setNodeDatatoChange: setNodeDatatoChange
    }
    const newNode: Node = {
      id: nodeId,
      data: newNodeData,
      type: 'metric',
      position: {
        x: x,
        y: y,
      },
    }
    updateElements('nodes', elements.nodes.concat(newNode), true)
  }, [project, setNodeDatatoChange, updateElements, elements.nodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      updateElements('edges', addEdge(connection, elements.edges), true)
    },
    [updateElements, elements.edges]
  )

  const loadFlow = useCallback(() => {
    const flowStr = localStorage.getItem(flowKey) || ''
    if (flowStr) {
      const flow = JSON.parse(flowStr)
      flow.nodes.forEach((node: Node) => {
        const nodeData: MetricNodeDataType = {
          ...node.data,
          setNodeDatatoChange: setNodeDatatoChange
        }
        node.data = nodeData
      })
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
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onConnect={onConnect}
        elementsSelectable={editingEnabled}
        nodesDraggable={editingEnabled}
        nodesConnectable={editingEnabled}
        panOnScroll={true}
        minZoom={0.1}
        maxZoom={10}
        deleteKeyCode={['Backspace', 'Delete']}
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
