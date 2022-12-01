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
  Connection,
  Controls,
  Edge,
  EdgeChange,
  HandleType,
  MiniMap,
  Node,
  NodeChange,
  OnMove,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from 'react-flow-renderer'

import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import { nodeTypes, edgeTypes, useGraph } from '../../contexts/graph'
import { useBrowser } from '../../contexts/browser'
import styles from '../../styles/GraphViewer.module.css'
import { analytics } from '../../utils/segmentClient'
import CommentsDock, { GRAPH_COMMENTS_TOPIC_ID } from './CommentsDock'
import ControlPanel from './ControlPanel'
import EditorDock from './editing/EditorDock'

const GraphViewer: FunctionComponent = () => {
  const { organizationName } = useAuth()
  const { editingEnabled } = useEditability()
  const {
    initialGraph,
    graph,
    setReactFlowInstance,
    reactFlowRenderer,
    setReactFlowRenderer,
    reactFlowViewport,
    setReactFlowViewport,
    undo,
    redo,
    updateGraph,
    setEdgeBeingUpdated,
    getConnectedObjects,
  } = useGraph()
  const {
    actionKey,
    actionKeyPressed,
    altKeyPressed,
    inputInProgress,
    shiftKeyPressed,
    push,
  } = useBrowser()
  const reactFlowInstance = useReactFlow()

  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (editingEnabled) {
        if (actionKeyPressed) {
          if (!shiftKeyPressed && e.key === 'z' && undo) {
            undo()
          } else if (shiftKeyPressed && e.key === 'z' && redo) {
            redo()
          }
        }
      } else {
        if (inputInProgress) {
          return
        }
        // zoom with action + arrow up / down, to match scroll pad behavior
        if (actionKeyPressed) {
          if (e.key === 'ArrowUp') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            reactFlowInstance!.zoomIn()
          } else if (e.key === 'ArrowDown') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            reactFlowInstance!.zoomOut()
          }
        } else {
          // move with arrow keys / WASD
          const nudgeAmount = shiftKeyPressed ? 100 : 10
          if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            reactFlowInstance.setViewport({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              ...reactFlowInstance.getViewport()!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              y: reactFlowInstance.getViewport()!.y + nudgeAmount,
            })
          } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            reactFlowInstance.setViewport({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              ...reactFlowInstance.getViewport()!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              y: reactFlowInstance.getViewport()!.y - nudgeAmount,
            })
          } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            reactFlowInstance.setViewport({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              ...reactFlowInstance.getViewport()!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              x: reactFlowInstance.getViewport()!.x + nudgeAmount,
            })
          } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            reactFlowInstance.setViewport({
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              ...reactFlowInstance.getViewport()!,
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              x: reactFlowInstance.getViewport()!.x - nudgeAmount,
            })
            // zoom with +/-  and i/o keys
          } else if (
            e.key === '-' ||
            e.key === '_' ||
            e.key === 'o' ||
            e.key === 'O'
          ) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            reactFlowInstance!.zoomOut()
          } else if (
            e.key === '=' ||
            e.key === '+' ||
            e.key === 'i' ||
            e.key === 'I'
          ) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            reactFlowInstance!.zoomIn()
            // fit with 0 or f key
          } else if (e.key === '0' || e.key === 'f' || e.key === 'F') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            reactFlowInstance!.fitView()
          }
        }
      }
    }
    document.addEventListener('keydown', keyDownHandler)
    // clean up
    return () => {
      document.removeEventListener('keydown', keyDownHandler)
    }
  }, [
    editingEnabled,
    actionKeyPressed,
    shiftKeyPressed,
    undo,
    redo,
    inputInProgress,
    reactFlowInstance,
    reactFlowViewport,
  ])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setReactFlowInstance!(reactFlowInstance)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setReactFlowRenderer!(document.querySelector('.react-flow__renderer')!)
  }, [reactFlowInstance, setReactFlowInstance, setReactFlowRenderer])
  useEffect(() => {
    if (reactFlowViewport) {
      // persist viewport within a tab's page views
      reactFlowInstance.setViewport(reactFlowViewport)
    } else {
      reactFlowInstance.fitView()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactFlowInstance.viewportInitialized, graph, initialGraph])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      updateGraph(
        { nodes: applyNodeChanges(changes, graph.nodes), edges: undefined },
        false
      )
    },
    [updateGraph, graph.nodes]
  )

  const onNodeDragStart = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      updateGraph(
        {
          nodes: graph.nodes.map((n) =>
            n.id === node.id
              ? { ...node, selected: true }
              : { ...n, selected: actionKeyPressed ? n.selected : false }
          ),
          edges: undefined,
        },
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
      updateGraph(
        { nodes: undefined, edges: applyEdgeChanges(changes, graph.edges) },
        true
      )
    },
    [updateGraph, graph.edges]
  )

  const [edgeUpdateInProgress, setEdgeUpdateInProgress] = useState(false)
  const onEdgeUpdateStart = useCallback(
    (_event: React.MouseEvent, edge: Edge, handleType: HandleType) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setEdgeBeingUpdated!({ edge: edge, handleType: handleType })
      setEdgeUpdateInProgress(true)
    },
    [setEdgeBeingUpdated, setEdgeUpdateInProgress]
  )
  const onEdgeUpdateEnd = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setEdgeBeingUpdated!(null)
    setEdgeUpdateInProgress(false)
  }, [setEdgeBeingUpdated, setEdgeUpdateInProgress])
  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      if (
        !(
          oldEdge.source === newConnection.source &&
          oldEdge.target === newConnection.target
        )
      ) {
        return // only allow same-source/target updates
      }
      const newEdge = {
        ...oldEdge,
        sourceHandle: newConnection.sourceHandle,
        targetHandle: newConnection.targetHandle,
      }
      updateGraph(
        {
          nodes: undefined,
          edges: graph.edges.map((e) => (e.id === oldEdge.id ? newEdge : e)),
        },
        true
      )
    },
    [updateGraph, graph.edges]
  )

  const onSelect = useCallback(
    (nodeOrEdge: Node | Edge) => {
      // clicking metric nodes opens metric detail when !editingEnabled
      if (nodeOrEdge.type === 'metric' && !editingEnabled) {
        if (altKeyPressed) {
          const metricNode = nodeOrEdge as Node
          reactFlowInstance.fitBounds({
            x: metricNode.position.x,
            y: metricNode.position.y,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            width: metricNode.width!,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            height: metricNode.height!,
          })
          analytics.track('snap_to_metric_node', {
            node_id: metricNode.id,
          })
        } else {
          push(`${organizationName}/metrics/${nodeOrEdge.id}`)
        }
      }
      // selecting any function node or input edge highlights all connected others
      // right now this essentially insures that an editor can't partially delete a formula
      if (nodeOrEdge.type === 'function' || nodeOrEdge.type === 'input') {
        if (!getConnectedObjects) {
          throw new Error('getConnectedObjects not defined')
        }
        if (!updateGraph) {
          throw new Error('updateGraph not defined')
        }
        const connectedObjects = getConnectedObjects(nodeOrEdge, 1).concat([
          nodeOrEdge,
        ])
        updateGraph(
          {
            nodes: graph.nodes.map((node) => {
              if (
                connectedObjects.find(
                  (c) => c.id === node.id && c.type === node.type
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
          false
        )
      }
    },
    [
      editingEnabled,
      altKeyPressed,
      reactFlowInstance,
      organizationName,
      push,
      getConnectedObjects,
      updateGraph,
      graph,
    ]
  )

  let lastMoveEndAt = 0
  const onMoveEnd: OnMove = (event, viewport) => {
    /* 
      Since onMoveEnd fires continuously while scrolling,
      below logic preserves performance by:
       - firing analytic event only if no subsequent onMoveEnd
          fires within 100ms
       - saving reactFlowViewport only if no subsequent onMoveEnd
          fires within 500ms
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
            width: reactFlowRenderer?.clientWidth,
            height: reactFlowRenderer?.clientHeight,
          })
        }
      },
      100,
      moveEndAt
    )
    setTimeout(
      (onMoveEndAt) => {
        if (onMoveEndAt === lastMoveEndAt) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          setReactFlowViewport!(viewport)
        }
      },
      500,
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
        onEdgeUpdate={editingEnabled ? onEdgeUpdate : undefined}
        onEdgeUpdateStart={editingEnabled ? onEdgeUpdateStart : undefined}
        onEdgeUpdateEnd={editingEnabled ? onEdgeUpdateEnd : undefined}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onMoveEnd={onMoveEnd}
        nodesDraggable={editingEnabled}
        nodesConnectable={edgeUpdateInProgress} // shows update preview while dragging
        snapToGrid={true}
        snapGrid={[16, 16]}
        panOnScroll={true}
        minZoom={0.01}
        maxZoom={10}
        deleteKeyCode={editingEnabled ? ['Backspace', 'Delete'] : []}
        multiSelectionKeyCode={editingEnabled ? actionKey : null}
        selectionKeyCode={editingEnabled ? 'Shift' : null}
        onlyRenderVisibleElements={false}
        proOptions={{
          account: 'paid-pro',
          hideAttribution: true,
        }}
      >
        <Background
          variant={
            editingEnabled ? BackgroundVariant.Dots : BackgroundVariant.Lines
          }
          gap={16}
          size={1}
        />
        <ControlPanel />
        <Controls showInteractive={false} />
        <EditorDock />
        <CommentsDock topicId={GRAPH_COMMENTS_TOPIC_ID} />
        <MiniMap nodeColor="#AFADFF" nodeStrokeColor="#AFADFF" />
      </ReactFlow>
    </div>
  )
}

export default GraphViewer
