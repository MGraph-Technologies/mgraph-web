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
} from 'reactflow'

import ControlPanel from 'components/graph/ControlPanel'
import EditorDock from 'components/graph/editing/EditorDock'
import { useAuth } from 'contexts/auth'
import { useBrowser } from 'contexts/browser'
import { useEditability } from 'contexts/editability'
import { nodeTypes, edgeTypes, useGraph } from 'contexts/graph'
import styles from 'styles/GraphViewer.module.css'
import { analytics } from 'utils/segmentClient'

const GraphViewer: FunctionComponent = () => {
  const { organizationName } = useAuth()
  const { editingEnabled } = useEditability()
  const {
    graph,
    setReactFlowInstance,
    reactFlowRenderer,
    setReactFlowRenderer,
    reactFlowViewport,
    setReactFlowViewport,
    initialGraphFitComplete,
    setInitialGraphFitComplete,
    undo,
    redo,
    updateGraph,
    setEdgeBeingUpdated,
    getConnectedObjects,
  } = useGraph()
  const {
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        setReactFlowViewport!(reactFlowInstance.getViewport())
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
    setReactFlowViewport,
  ])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setReactFlowInstance!(reactFlowInstance)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    setReactFlowRenderer!(document.querySelector('.react-flow__renderer')!)
  }, [reactFlowInstance, setReactFlowInstance, setReactFlowRenderer])

  const [graphViewInitialized, setGraphViewInitialized] = useState(false)
  useEffect(() => {
    if (!reactFlowInstance.viewportInitialized || graphViewInitialized) {
      return
    } else if (graph.nodes.length > 0) {
      if (!initialGraphFitComplete) {
        // fit to view on initial load
        reactFlowInstance.fitView()
        setInitialGraphFitComplete?.(true)
      } else if (reactFlowViewport) {
        // persist viewport within a tab's page views
        reactFlowInstance.setViewport(reactFlowViewport)
      }
      setGraphViewInitialized(true)
    }
  }, [
    reactFlowInstance,
    graphViewInitialized,
    graph.nodes,
    initialGraphFitComplete,
    setInitialGraphFitComplete,
    reactFlowViewport,
  ])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // handle deletes via onNodesDelete
      if (changes.find((c) => c.type === 'remove')) {
        return
      }
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

  const onNodesDelete = useCallback(
    (nodes: Node[]) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      if (!getConnectedObjects) {
        throw new Error('getConnectedObjects not defined')
      }
      // delete node + connected input edges and function nodes
      const toDelete: string[] = []
      nodes.forEach((node) => {
        toDelete.push(node.id)
        const connectedObjects = getConnectedObjects(node, 1)
        connectedObjects.forEach((o) => {
          if (o.type === 'input' || o.type === 'function') {
            toDelete.push(o.id)
          }
        })
      })
      updateGraph(
        {
          nodes: graph.nodes.filter((n) => !toDelete.includes(n.id)),
          edges: graph.edges.filter((e) => !toDelete.includes(e.id)),
        },
        true
      )
    },
    [getConnectedObjects, updateGraph, graph.nodes, graph.edges]
  )

  const onNodeDragStart = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (!updateGraph) {
        throw new Error('updateGraph not defined')
      }
      // multiselection
      if (actionKeyPressed) {
        updateGraph(
          {
            nodes: graph.nodes.map((n) =>
              n.id === node.id
                ? { ...node, selected: true }
                : { ...n, selected: n.selected }
            ),
            edges: undefined,
          },
          true
        )
      }
    },
    [updateGraph, graph, actionKeyPressed]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      // handle deletes via onNodesDelete
      if (changes.find((c) => c.type === 'remove')) {
        return
      }
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
      // clicking custom or metric nodes opens metric detail when !editingEnabled
      if (
        ['custom', 'metric'].includes(nodeOrEdge.type || '') &&
        !editingEnabled
      ) {
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
          push(`${organizationName}/nodes/${nodeOrEdge.id}`)
        }
      }
      // selecting any function node or input edge highlights all connected others
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
                  selected:
                    node.type === 'function'
                      ? true
                      : // select function nodes only on double click, unless multi-selecting
                        !node.selected || actionKeyPressed || shiftKeyPressed,
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
      actionKeyPressed,
      shiftKeyPressed,
    ]
  )

  const [reactFlowViewportInitialized, setReactFlowViewportInitialized] =
    useState(false)
  const onMove: OnMove = (_event, viewport) => {
    // use to initialize reactFlowViewport
    if (!reactFlowViewportInitialized) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setReactFlowViewport!(viewport)
      setReactFlowViewportInitialized(true)
    }
  }

  let lastMoveEndAt = 0
  const onMoveEnd: OnMove = (event, viewport) => {
    /* 
      Since onMoveEnd fires continuously while scrolling,
      below logic preserves performance by:
       - firing analytic event only if no subsequent onMoveEnd
          fires within 100ms
       - saving reactFlowViewport only if no subsequent onMoveEnd
          fires within 500ms (100ms if editingEnabled)
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
      editingEnabled ? 100 : 500,
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
        onNodesDelete={onNodesDelete}
        onEdgeClick={(_event, edge) => onSelect(edge)}
        onEdgeUpdate={editingEnabled ? onEdgeUpdate : undefined}
        onEdgeUpdateStart={editingEnabled ? onEdgeUpdateStart : undefined}
        onEdgeUpdateEnd={editingEnabled ? onEdgeUpdateEnd : undefined}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        nodesDraggable={editingEnabled}
        nodesConnectable={edgeUpdateInProgress} // shows update preview while dragging
        snapToGrid={true}
        snapGrid={[16, 16]}
        panOnScroll={true}
        minZoom={0.01}
        maxZoom={10}
        deleteKeyCode={editingEnabled ? ['Backspace', 'Delete'] : []}
        disableKeyboardA11y={
          // disable when input is focused
          document.activeElement?.tagName === 'INPUT'
        }
        multiSelectionKeyCode={null} // handled manually above
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
          gap={32}
          size={4}
        />
        <ControlPanel />
        <Controls showInteractive={false} />
        <EditorDock parent="GraphViewer" />
        <MiniMap nodeColor="#AFADFF" nodeStrokeColor="#AFADFF" />
      </ReactFlow>
    </div>
  )
}

export default GraphViewer
