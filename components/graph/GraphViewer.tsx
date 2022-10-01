import React, {
  FunctionComponent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  EdgeChange,
  MiniMap,
  Node,
  NodeChange,
  Viewport,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from 'react-flow-renderer'

import { useEditability } from '../../contexts/editability'
import { nodeTypes, edgeTypes, useGraph } from '../../contexts/graph'
import styles from '../../styles/GraphViewer.module.css'
import { analytics } from '../../utils/segmentClient'
import ControlPanel from './ControlPanel'
import EditorDock from './editing/EditorDock'

type GraphViewerProps = {}
const GraphViewer: FunctionComponent<GraphViewerProps> = () => {
  const { editingEnabled } = useEditability()
  const {
    initialGraph,
    graph,
    setReactFlowInstance,
    undo,
    redo,
    updateGraph,
    getConnectedObjects,
  } = useGraph()

  const actionKey = navigator.platform.match(/Mac/i) ? 'Meta' : 'Control'
  const [actionKeyPressed, setActionKeyPressed] = useState(false)
  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(true)
      }
      if (actionKeyPressed && !e.shiftKey && e.key === 'z' && undo) {
        undo()
      }
      if (actionKeyPressed && e.shiftKey && e.key === 'z' && redo) {
        redo()
      }
    }
    document.addEventListener('keydown', keyDownHandler)
    // clean up
    return () => {
      document.removeEventListener('keydown', keyDownHandler)
    }
  }, [actionKey, actionKeyPressed, undo, redo])

  useEffect(() => {
    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(false)
      }
    }
    document.addEventListener('keyup', keyUpHandler)
    // clean up
    return () => {
      document.removeEventListener('keyup', keyUpHandler)
    }
  }, [actionKey, actionKeyPressed])

  const reactFlowInstance = useReactFlow()
  useEffect(() => {
    setReactFlowInstance!(reactFlowInstance)
  }, [reactFlowInstance, setReactFlowInstance])
  useEffect(() => {
    reactFlowInstance.fitView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance.viewportInitialized, initialGraph])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      updateGraph('nodes', applyNodeChanges(changes, graph.nodes), false)
    },
    [updateGraph, graph.nodes]
  )

  const onNodeDragStart = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      updateGraph(
        'nodes',
        graph.nodes.map((n) =>
          n.id === node.id
            ? { ...node, selected: true }
            : { ...n, selected: actionKeyPressed ? n.selected : false }
        ),
        true
      )
    },
    [updateGraph, graph, actionKeyPressed]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      updateGraph('edges', applyEdgeChanges(changes, graph.edges), true)
    },
    [updateGraph, graph.edges]
  )

  // selecting any function node or input edge selects all connected others
  // right now this essentially insures that an editor can't partially delete a formula
  const onSelect = useCallback(
    (nodeOrEdge: Node | Edge) => {
      if (nodeOrEdge.type === 'function' || nodeOrEdge.type === 'input') {
        if (!getConnectedObjects) {
          throw new Error('getConnectedObjects not defined')
        }
        if (!updateGraph) {
          throw new Error('updateGraph not defined')
        }
        const connectedObjects = getConnectedObjects(nodeOrEdge).concat([
          nodeOrEdge,
        ])
        updateGraph(
          'all',
          [
            {
              nodes: graph.nodes.map((node) => {
                if (
                  connectedObjects.find(
                    (c) =>
                      c.id === node.id &&
                      c.type === node.type &&
                      c.type !== 'metric'
                  )
                ) {
                  return {
                    ...node,
                    selected: true,
                  }
                } else {
                  return node
                }
              }),
              edges: graph.edges.map((edge) => {
                if (
                  connectedObjects.find(
                    (c) => c.id === edge.id && c.type === edge.type
                  )
                ) {
                  return {
                    ...edge,
                    selected: true,
                  }
                } else {
                  return edge
                }
              }),
            },
          ],
          false
        )
      }
    },
    [getConnectedObjects, updateGraph, graph]
  )

  let lastMoveEndAt = 0
  const onMoveEnd = (event: any, viewport: Viewport) => {
    /* 
      fire change_graph_viewport analytics event
      (since onMoveEnd fires continuously while scrolling,
        below logic ensures analytic only fires if no subsequent
        onMoveEnd fires within 100ms)
    */
    const moveEndAt = Date.now()
    lastMoveEndAt = moveEndAt
    setTimeout(
      (onMoveEndAt) => {
        if (onMoveEndAt === lastMoveEndAt) {
          analytics.track('change_graph_viewport', {
            x: viewport.x,
            y: viewport.y,
            zoom: viewport.zoom,
            event_type: event?.type,
          })
        }
      },
      100,
      moveEndAt
    )
  }

  return (
    <div className={styles.graph_viewer}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_event, node) => onSelect(node)}
        onNodesChange={onNodesChange}
        onEdgeClick={(_event, edge) => onSelect(edge)}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onMoveEnd={onMoveEnd}
        nodesDraggable={editingEnabled}
        nodesConnectable={false}
        snapToGrid={true}
        snapGrid={[16, 16]}
        panOnScroll={true}
        minZoom={0.01}
        maxZoom={10}
        deleteKeyCode={editingEnabled ? ['Backspace', 'Delete'] : []}
        multiSelectionKeyCode={[actionKey]}
        onlyRenderVisibleElements={false}
        proOptions={{
          account: 'paid-pro',
          hideAttribution: true,
        }}
      >
        {editingEnabled
          ? <Background variant={BackgroundVariant.Lines} gap={16} size={1} />
          : null}
        <ControlPanel />
        <Controls showInteractive={false} />
        <EditorDock />
        <MiniMap nodeColor="#AFADFF" nodeStrokeColor="#AFADFF" />
      </ReactFlow>
    </div>
  )
}

export default GraphViewer
