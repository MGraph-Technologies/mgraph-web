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
import styles from '../styles/GraphViewer.module.css'

const graphKey = 'example-flow' // TODO: load flow from db
const userCanEdit = true // TODO: get this from db

const nodeTypes = { metric: MetricNode }

type GraphViewerProps = {}
const GraphViewer: FunctionComponent<GraphViewerProps> = () => {
  const { editingEnabled, enableEditing, disableEditing } = useEditability()
  const initialNodes: Node[] = []
  const initialEdges: Edge[] = []
  const [graph, setGraph, { undo, redo, canUndo, canRedo, reset }] =
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
      document.removeEventListener('keydown', keyDownHandler)
    }
  }, [undo, redo])
  const { project } = useReactFlow()

  const updateGraph = useCallback(
    (t: 'nodes' | 'edges', v: Array<any>, undoable: boolean) => {
      // To prevent a mismatch of state updates,
      // we'll use the value passed into this
      // function instead of the state directly.
      setGraph(
        (e) => ({
          nodes: t === 'nodes' ? v : e.nodes,
          edges: t === 'edges' ? v : e.edges,
        }),
        undefined,
        !undoable
      )
    },
    [setGraph]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      updateGraph('nodes', applyNodeChanges(changes, graph.nodes), false)
    },
    [updateGraph, graph.nodes]
  )

  /* ideally we'd use a callback for this, but I don't think it's currently possible
  https://github.com/wbkd/react-flow/discussions/2270 */
  const [nodeDataToChange, setNodeDatatoChange] = useState<MetricNodeDataType>()
  useEffect(() => {
    if (nodeDataToChange) {
      const nodeId = nodeDataToChange.nodeId
      const node = graph.nodes.find((n) => n.id === nodeId)
      const otherNodes = graph.nodes.filter((n) => n.id !== nodeId)
      if (node) {
        let nodeClone = JSON.parse(JSON.stringify(node)) // so updateGraph detects a change
        nodeClone.data = nodeDataToChange
        updateGraph('nodes', otherNodes.concat(nodeClone), true)
      }
      setNodeDatatoChange(undefined) // avoid infinite loop
    }
  }, [nodeDataToChange, setNodeDatatoChange, updateGraph, graph.nodes])

  const onNodeAddition = useCallback(() => {
    const { x, y } = project({
      x: self.innerWidth / 4,
      y: self.innerHeight - 250,
    })
    const nodeId = `randomnode_${+new Date()}`
    const newNodeData: MetricNodeDataType = {
      nodeId: nodeId, // needed for setNodeDataToChange
      name: 'New Metric',
      color: '#FFFFFF',
      setNodeDatatoChange: setNodeDatatoChange,
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
    updateGraph('nodes', graph.nodes.concat(newNode), true)
  }, [project, setNodeDatatoChange, updateGraph, graph.nodes])

  const onNodeDragStart = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      updateGraph(
        'nodes',
        graph.nodes.map((n) => (n.id === node.id ? node : n)),
        true
      )
    },
    [updateGraph, graph]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      updateGraph('edges', applyEdgeChanges(changes, graph.edges), true)
    },
    [updateGraph, graph.edges]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      updateGraph(
        'edges',
        addEdge({ ...connection, animated: true }, graph.edges),
        true
      )
    },
    [updateGraph, graph.edges]
  )

  const loadGraph = useCallback(() => {
    const graphStr = localStorage.getItem(graphKey) || ''
    if (graphStr) {
      const parsedGraph = JSON.parse(graphStr)
      parsedGraph.nodes.forEach((node: Node) => {
        const nodeData: MetricNodeDataType = {
          ...node.data,
          setNodeDatatoChange: setNodeDatatoChange,
        }
        node.data = nodeData
      })
      reset({ nodes: parsedGraph.nodes, edges: parsedGraph.edges })
    }
  }, [reset])
  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const saveGraph = useCallback(() => {
    graph.nodes = graph.nodes.map((n) => ({ ...n, selected: false }))
    graph.edges = graph.edges.map((e) => ({ ...e, selected: false }))
    localStorage.setItem(graphKey, JSON.stringify(graph))
    reset({ nodes: graph.nodes, edges: graph.edges })
  }, [graph, reset])

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
      saveGraph()
      disableEditing()
    }, [])

    const cancelEditing = useCallback(() => {
      loadGraph()
      disableEditing()
    }, [])

    if (editingEnabled) {
      return (
        <div className={styles.editor_dock}>
          <Toolbar
            className={styles.editor_toolbar}
            left={
              <div>
                <Button icon="pi pi-plus" onClick={onNodeAddition} />
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
    <div className={styles.graph_viewer}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onConnect={onConnect}
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

export default GraphViewer
