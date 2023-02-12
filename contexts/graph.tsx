import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import {
  Edge,
  HandleType,
  Node,
  Position,
  ReactFlowInstance,
  Viewport,
  XYPosition,
} from 'reactflow'
import useUndoable from 'use-undoable'
import { v4 as uuidv4 } from 'uuid'

import CustomNode, {
  CustomNodeProperties,
  CustomNodeSource,
} from 'components/graph/CustomNode'
import FunctionNode, {
  FunctionNodeProperties,
} from 'components/graph/FunctionNode'
import InputEdge, { InputEdgeProperties } from 'components/graph/InputEdge'
import MetricNode, { MetricNodeProperties } from 'components/graph/MetricNode'
import { GoalStatus } from 'components/graph/node_detail/GoalsTable'
import { useAuth } from 'contexts/auth'
import { useEditability } from 'contexts/editability'
import { getLastUpdatedAt } from 'utils/queryUtils'
import { supabase } from 'utils/supabaseClient'

export const nodeTypes = {
  custom: CustomNode,
  metric: MetricNode,
  function: FunctionNode,
}
export const edgeTypes = {
  input: InputEdge,
}

export type Graph = {
  nodes: Node[]
  edges: Edge[]
}
type TypeIdMap = { [key: string]: string }

type GoalStatusMap = {
  [metricNodeId: string]: { [goalId: string]: GoalStatus }
}

type LatestCommentIdMap = {
  [metricNodeId: string]: string | null
}

type GraphContextType = {
  initialGraph: Graph
  graph: Graph
  goalStatusMap: GoalStatusMap
  setGoalStatusMap: Dispatch<SetStateAction<GoalStatusMap>> | undefined
  latestCommentIdMap: LatestCommentIdMap
  setLatestCommentIdMap:
    | Dispatch<SetStateAction<LatestCommentIdMap>>
    | undefined
  /* reactFlowInstance is produced by useReactFlow(), which must be called
    in a component that is wrapped in a ReactFlowProvider. Thus, we can't
    instantiate it directly here but instead pass it back from GraphViewer. */
  reactFlowInstance: ReactFlowInstance | undefined
  setReactFlowInstance:
    | Dispatch<SetStateAction<ReactFlowInstance | undefined>>
    | undefined
  reactFlowRenderer: Element | undefined
  setReactFlowRenderer:
    | Dispatch<SetStateAction<Element | undefined>>
    | undefined
  reactFlowViewport: Viewport | undefined
  setReactFlowViewport:
    | Dispatch<SetStateAction<Viewport | undefined>>
    | undefined
  initialGraphFitComplete: boolean
  setInitialGraphFitComplete: Dispatch<SetStateAction<boolean>> | undefined
  nodeShouldRender:
    | ((node: Node, xPos: number, yPos: number) => boolean)
    | undefined
  undo: (() => void) | undefined
  redo: (() => void) | undefined
  canUndo: boolean
  canRedo: boolean
  loadGraph: (() => Promise<void>) | undefined
  saveGraph: (() => Promise<Response | undefined>) | undefined
  updateGraph:
    | ((
        update: { nodes: Node[] | undefined; edges: Edge[] | undefined },
        undoable: boolean
      ) => void)
    | undefined
  setNodeDataToChange:
    | Dispatch<
        SetStateAction<
          | CustomNodeProperties
          | MetricNodeProperties
          | FunctionNodeProperties
          | undefined
        >
      >
    | undefined
  setEdgeBeingUpdated:
    | Dispatch<SetStateAction<{ edge: Edge; handleType: HandleType } | null>>
    | undefined
  formNodeHandleStyle:
    | ((
        nodeId: string,
        handleType: HandleType,
        handlePosition: Position
      ) => React.CSSProperties)
    | undefined
  formCustomNode: (() => Node) | undefined
  formMetricNode: (() => Node) | undefined
  formFunctionNode:
    | ((
        newNodeId: string,
        functionTypeId: string,
        inputNodes: Node[],
        outputNode: Node
      ) => Node)
    | undefined
  getFunctionSymbol: ((functionTypeId: string) => string) | undefined
  formInputEdge:
    | ((
        source: Node,
        target: Node,
        displaySource?: Node | undefined,
        displayTarget?: Node | undefined
      ) => Edge)
    | undefined
  getConnectedObjects:
    | ((
        reference: Node | Edge,
        maxSeparationDegrees?: number,
        direction?: 'inputs' | 'outputs'
      ) => (Node | Edge)[])
    | undefined
}

const graphContextDefaultValues: GraphContextType = {
  initialGraph: {
    nodes: [],
    edges: [],
  },
  graph: {
    nodes: [],
    edges: [],
  },
  goalStatusMap: {},
  setGoalStatusMap: undefined,
  latestCommentIdMap: {},
  setLatestCommentIdMap: undefined,
  reactFlowInstance: undefined,
  setReactFlowInstance: undefined,
  reactFlowRenderer: undefined,
  setReactFlowRenderer: undefined,
  reactFlowViewport: undefined,
  setReactFlowViewport: undefined,
  initialGraphFitComplete: false,
  setInitialGraphFitComplete: undefined,
  nodeShouldRender: undefined,
  undo: undefined,
  redo: undefined,
  canUndo: false,
  canRedo: false,
  loadGraph: undefined,
  saveGraph: undefined,
  updateGraph: undefined,
  setNodeDataToChange: undefined,
  setEdgeBeingUpdated: undefined,
  formNodeHandleStyle: undefined,
  formCustomNode: undefined,
  formMetricNode: undefined,
  formFunctionNode: undefined,
  getFunctionSymbol: undefined,
  formInputEdge: undefined,
  getConnectedObjects: undefined,
}

const GraphContext = createContext<GraphContextType>(graphContextDefaultValues)

export function useGraph() {
  return useContext(GraphContext)
}

type GraphProps = {
  children: ReactNode
}

export function GraphProvider({ children }: GraphProps) {
  const { getValidAccessToken, organizationId, userOnMobile } = useAuth()
  const { editingEnabled } = useEditability()

  const [initialGraph, setInitialGraph] = useState<Graph>({
    nodes: [],
    edges: [],
  })
  const [graph, setGraph, { undo, redo, canUndo, canRedo, reset }] =
    useUndoable<Graph>(initialGraph, {
      behavior: 'destroyFuture',
      ignoreIdenticalMutations: false,
    })

  const [goalStatusMap, setGoalStatusMap] = useState<GoalStatusMap>({})
  const [latestCommentIdMap, setLatestCommentIdMap] =
    useState<LatestCommentIdMap>({})

  const [reactFlowInstance, setReactFlowInstance] = useState<
    ReactFlowInstance | undefined
  >()
  const [reactFlowRenderer, setReactFlowRenderer] = useState<Element>()
  const [reactFlowViewport, setReactFlowViewport] = useState<Viewport>()
  const [initialGraphFitComplete, setInitialGraphFitComplete] =
    useState<boolean>(false)

  const nodeShouldRender = useCallback(
    (node: Node, xPos: number, yPos: number) => {
      if (!reactFlowViewport || !reactFlowRenderer || !node) return false
      const scale = 1 / reactFlowViewport.zoom
      const clientWidth = reactFlowRenderer.clientWidth
      const clientHeight = reactFlowRenderer.clientHeight
      const clientWidthScaled = clientWidth * scale
      const clientHeightScaled = clientHeight * scale
      const rendererXLower = -reactFlowViewport.x * scale
      const rendererXUpper = rendererXLower + clientWidthScaled
      const rendererYLower = -reactFlowViewport.y * scale
      const rendererYUpper = rendererYLower + clientHeightScaled
      const nodeXLower = xPos
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const nodeXUpper = xPos + node.width!
      const nodeYLower = yPos
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const nodeYUpper = yPos + node.height!
      const xBuffer = userOnMobile ? 0 : clientWidth
      const yBuffer = userOnMobile ? 0 : clientHeight
      const minZoom = userOnMobile ? 0.2 : 0.1
      return Boolean(
        nodeXLower < rendererXUpper + xBuffer &&
          nodeXUpper > rendererXLower - xBuffer &&
          nodeYLower < rendererYUpper + yBuffer &&
          nodeYUpper > rendererYLower - yBuffer &&
          reactFlowViewport.zoom > minZoom
      )
    },
    [reactFlowViewport, reactFlowRenderer, userOnMobile]
  )

  const [nodeTypeIds, setNodeTypeIds] = useState<TypeIdMap>(
    Object.fromEntries(Object.keys(nodeTypes).map((key) => [key, '']))
  )
  async function getNodeTypeIds() {
    try {
      const { data, error, status } = await supabase
        .from('node_types')
        .select('name, id')
        .is('deleted_at', null)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        const _nodeTypeIds = {} as TypeIdMap
        for (const nodeType in nodeTypeIds) {
          const nodeTypeId = data.find((n) => n.name === nodeType)?.id
          if (nodeTypeId) {
            _nodeTypeIds[nodeType] = nodeTypeId
          } else {
            throw new Error(`Could not find node type id for ${nodeType}`)
          }
          setNodeTypeIds(_nodeTypeIds)
        }
      }
    } catch (error: unknown) {
      console.error(error)
    }
  }
  useEffect(() => {
    getNodeTypeIds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [edgeTypeIds, setEdgeTypeIds] = useState<TypeIdMap>(
    Object.fromEntries(Object.keys(edgeTypes).map((key) => [key, '']))
  )
  async function getEdgeTypeIds() {
    try {
      const { data, error, status } = await supabase
        .from('edge_types')
        .select('name, id')
        .is('deleted_at', null)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        const _edgeTypeIds = {} as TypeIdMap
        for (const edgeType in edgeTypeIds) {
          const edgeTypeId = data.find((e) => e.name === edgeType)?.id
          if (edgeTypeId) {
            _edgeTypeIds[edgeType] = edgeTypeId
          } else {
            throw new Error(`Could not find edge type id for ${edgeType}`)
          }
          setEdgeTypeIds(_edgeTypeIds)
        }
      }
    } catch (error: unknown) {
      console.error(error)
    }
  }
  useEffect(() => {
    getEdgeTypeIds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [graphInitializedAt, setGraphInitializedAt] = useState<
    Date | undefined
  >()
  const loadGraph = useCallback(async () => {
    const accessToken = getValidAccessToken()
    if (!accessToken || !organizationId) {
      return
    }
    // if graph not updated since last load, load from cache
    if (graphInitializedAt) {
      const nodesUpdatedAt =
        (await getLastUpdatedAt(
          'nodes',
          { organization_id: organizationId },
          supabase
        )) || new Date(0)
      const edgesUpdatedAt =
        (await getLastUpdatedAt(
          'edges',
          { organization_id: organizationId },
          supabase
        )) || new Date(0)
      const monitoringRuleEvalsUpdatedAt =
        (await getLastUpdatedAt(
          'latest_monitoring_rule_evaluations',
          { organization_id: organizationId },
          supabase
        )) || new Date(0)
      if (
        nodesUpdatedAt < graphInitializedAt &&
        edgesUpdatedAt < graphInitializedAt &&
        monitoringRuleEvalsUpdatedAt < graphInitializedAt
      ) {
        reset({
          // initial graph with selections preserved
          nodes: initialGraph.nodes.map((node) => {
            return {
              ...node,
              selected: graph.nodes.find((n) => n.id === node.id)?.selected,
            }
          }),
          edges: initialGraph.edges.map((edge) => {
            return {
              ...edge,
              selected: graph.edges.find((e) => e.id === edge.id)?.selected,
            }
          }),
        })
        return
      }
    }
    try {
      fetch(`/api/v1/graphs/${organizationId}`, {
        method: 'GET',
        headers: {
          'supabase-access-token': accessToken,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          let _graph = data.graph as Graph
          if (_graph) {
            _graph = {
              edges: _graph.edges,
              nodes: _graph.nodes.map((node) => {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    setNodeDataToChange: setNodeDataToChange,
                  },
                }
              }),
            }
            setGraphInitializedAt(new Date())
            setInitialGraph(_graph)
            reset(_graph)
          }
        })
    } catch (error: unknown) {
      console.error(error)
    }
  }, [
    getValidAccessToken,
    organizationId,
    graphInitializedAt,
    initialGraph,
    graph,
    reset,
  ])
  useEffect(() => {
    if (!graphInitializedAt) {
      loadGraph()
    }
  }, [loadGraph, graphInitializedAt])

  const saveGraph = useCallback(async () => {
    const accessToken = getValidAccessToken()
    if (!accessToken || !organizationId) {
      return
    }
    // remove selections
    graph.nodes = graph.nodes.map((n) => ({ ...n, selected: false }))
    graph.edges = graph.edges.map((e) => ({ ...e, selected: false }))

    return fetch(`/api/v1/graphs/${organizationId}`, {
      method: 'PUT',
      body: JSON.stringify({
        initialGraph: initialGraph,
        updatedGraph: graph,
      }),
      headers: {
        'supabase-access-token': accessToken,
      },
    })
  }, [getValidAccessToken, organizationId, graph, initialGraph])

  const updateGraph = useCallback(
    (
      update: { nodes: Node[] | undefined; edges: Edge[] | undefined },
      undoable: boolean
    ) => {
      // To prevent a mismatch of state updates,
      // we'll use the value passed into this
      // function instead of the state directly.
      setGraph(
        (graph) => {
          return {
            nodes: update.nodes || graph.nodes,
            edges: update.edges || graph.edges,
          } as Graph
        },
        undefined,
        !undoable
      )
    },
    [setGraph]
  )

  // listen for graph changes
  useEffect(() => {
    const nodesSubscription = supabase
      .from('nodes')
      .on('*', (payload) => {
        if (payload.eventType === 'INSERT') {
          const node = {
            ...payload.new.react_flow_meta,
            data: {
              ...payload.new.properties,
              setNodeDataToChange: setNodeDataToChange,
            },
          } as Node
          updateGraph(
            {
              nodes: [...graph.nodes, node],
              edges: undefined,
            },
            false
          )
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.deleted_at) {
            const node = payload.new as Node
            updateGraph(
              {
                nodes: graph.nodes.filter((n) => n.id !== node.id),
                edges: undefined,
              },
              false
            )
          } else {
            const node = {
              ...payload.new.react_flow_meta,
              data: {
                ...payload.new.properties,
                setNodeDataToChange: setNodeDataToChange,
              },
            } as Node
            updateGraph(
              {
                nodes: graph.nodes.map((n) => {
                  if (n.id === node.id) {
                    return node
                  } else {
                    return n
                  }
                }),
                edges: undefined,
              },
              false
            )
          }
        }
      })
      .subscribe()
    const edgesSubscription = supabase
      .from('edges')
      .on('*', (payload) => {
        if (payload.eventType === 'INSERT') {
          const edge = {
            ...payload.new.react_flow_meta,
            data: payload.new.properties,
          } as Edge
          updateGraph(
            {
              nodes: undefined,
              edges: [...graph.edges, edge],
            },
            false
          )
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.deleted_at) {
            const edge = payload.new as Edge
            updateGraph(
              {
                nodes: undefined,
                edges: graph.edges.filter((e) => e.id !== edge.id),
              },
              false
            )
          } else {
            const edge = {
              ...payload.new.react_flow_meta,
              data: payload.new.properties,
            } as Edge
            updateGraph(
              {
                nodes: undefined,
                edges: graph.edges.map((e) => {
                  if (e.id === edge.id) {
                    return edge
                  } else {
                    return e
                  }
                }),
              },
              false
            )
          }
        }
      })
      .subscribe()
    const monitoringRuleEvalsSubscription = supabase
      .from('monitoring_rule_evaluations')
      // inserts are pending, status comes through via update
      .on('UPDATE', async (payload) => {
        if (payload.new.status === 'pending' || payload.new.deleted_at) {
          return
        }
        // query for node id
        const { data, status, error } = await supabase
          .from('monitoring_rules')
          .select('parent_node_id')
          .eq('id', payload.new.monitoring_rule_id)
          .single()
        if (error && status !== 406) {
          throw error
        }
        if (data) {
          // update node in graph
          updateGraph(
            {
              nodes: graph.nodes.map((n) => {
                if (n.id === data.parent_node_id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      monitored: true,
                      alert: ['alert', 'timed_out'].includes(
                        payload.new.status
                      ),
                    },
                  }
                } else {
                  return n
                }
              }),
              edges: undefined,
            },
            false
          )
        }
      })
      .subscribe()
    const commentsSubscription = supabase
      .from('sce_comments')
      .on('INSERT', (payload) => {
        const comment = payload.new
        setLatestCommentIdMap((latestCommentIdMap) => {
          return {
            ...latestCommentIdMap,
            [comment.topic]: comment.id,
          }
        })
      })
      .subscribe()
    return () => {
      nodesSubscription.unsubscribe()
      edgesSubscription.unsubscribe()
      monitoringRuleEvalsSubscription.unsubscribe()
      commentsSubscription.unsubscribe()
    }
  }, [updateGraph, graph])

  /* ideally we'd use a callback for this, but I don't think it's currently possible
  https://github.com/wbkd/react-flow/discussions/2270 */
  const [nodeDataToChange, setNodeDataToChange] = useState<
    CustomNodeProperties | MetricNodeProperties | FunctionNodeProperties
  >()
  useEffect(() => {
    if (nodeDataToChange) {
      const nodeToChangeId = nodeDataToChange.id
      const nodeToChange = graph.nodes.find((n) => n.id === nodeToChangeId)
      const otherNodes = graph.nodes.filter((n) => n.id !== nodeToChangeId)
      if (nodeToChange) {
        const nodeToChangeClone = JSON.parse(JSON.stringify(nodeToChange)) // so updateGraph detects a change
        nodeToChangeClone.data = nodeDataToChange
        updateGraph(
          { nodes: otherNodes.concat(nodeToChangeClone), edges: undefined },
          true
        )
      }
      setNodeDataToChange(undefined) // avoid infinite loop
    }
  }, [nodeDataToChange, setNodeDataToChange, updateGraph, graph.nodes])

  const [edgeBeingUpdated, setEdgeBeingUpdated] = useState<{
    edge: Edge
    handleType: HandleType
  } | null>(null)
  const formNodeHandleStyle = useCallback(
    (nodeId: string, handleType: HandleType, handlePosition: Position) => {
      let handleSize = '0px'
      if (editingEnabled) {
        if (edgeBeingUpdated) {
          const handleEligibleForConnection =
            handleType !== edgeBeingUpdated?.handleType &&
            edgeBeingUpdated?.edge[handleType] === nodeId
          if (handleEligibleForConnection) {
            handleSize = '24px'
          }
        } else {
          const handleIsConnected = graph.edges.some((edge) => {
            return (
              edge[handleType] === nodeId &&
              edge[(handleType + 'Handle') as keyof Edge]?.startsWith(
                handlePosition
              )
            )
          })
          if (handleIsConnected) {
            handleSize = '12px'
          }
        }
      }
      const handleColor = handleType === 'source' ? 'green' : 'red'
      return {
        width: handleSize,
        minWidth: handleSize,
        height: handleSize,
        minHeight: handleSize,
        backgroundColor: handleColor,
      } as React.CSSProperties
    },
    [editingEnabled, edgeBeingUpdated, graph.edges]
  )

  const formCustomNode = useCallback(() => {
    const newNodeType = 'custom'
    const newNodeTypeId = nodeTypeIds[newNodeType]
    if (!newNodeTypeId) {
      throw new Error(`Could not find node type id for ${newNodeType}`)
    }

    const { x, y } =
      reactFlowInstance && reactFlowInstance.project
        ? reactFlowInstance.project({
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            x: reactFlowRenderer!.clientWidth / 2,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            y: reactFlowRenderer!.clientHeight / 2,
          })
        : { x: 0, y: 0 }
    const newNodeId = uuidv4()
    const newNodeData: CustomNodeProperties = {
      id: newNodeId, // needed for setNodeDataToChange
      organizationId: organizationId,
      typeId: newNodeTypeId,
      name: 'New Custom Node',
      description: '',
      owner: '',
      source: {
        html: '',
        css: '',
      } as CustomNodeSource,
      color: '#FFFFFF',
      initialProperties: {},
      setNodeDataToChange: setNodeDataToChange,
    }
    const newNode: Node = {
      id: newNodeId,
      data: newNodeData,
      type: newNodeType,
      position: {
        x: x,
        y: y,
      },
    }
    return newNode
  }, [
    nodeTypeIds,
    reactFlowInstance,
    reactFlowRenderer,
    organizationId,
    setNodeDataToChange,
  ])

  const formMetricNode = useCallback(() => {
    const newNodeType = 'metric'
    const newNodeTypeId = nodeTypeIds[newNodeType]
    if (!newNodeTypeId) {
      throw new Error(`Could not find node type id for ${newNodeType}`)
    }

    const { x, y } =
      reactFlowInstance && reactFlowInstance.project
        ? reactFlowInstance.project({
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            x: reactFlowRenderer!.clientWidth / 2,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            y: reactFlowRenderer!.clientHeight / 2,
          })
        : { x: 0, y: 0 }
    const newNodeId = uuidv4()
    const newNodeData: MetricNodeProperties = {
      id: newNodeId, // needed for setNodeDataToChange
      organizationId: organizationId,
      typeId: newNodeTypeId,
      name: 'New Metric Node',
      description: '',
      owner: '',
      source: {
        databaseConnectionId: '',
        query: '',
        queryType: 'freeform',
        dbtProjectGraphSyncId: null,
        dbtProjectMetricPath: null,
      },
      color: '#FFFFFF',
      tablePosition: null,
      initialProperties: {},
      setNodeDataToChange: setNodeDataToChange,
      monitored: false,
      alert: undefined,
    }
    const newNode: Node = {
      id: newNodeId,
      data: newNodeData,
      type: newNodeType,
      position: {
        x: x,
        y: y,
      },
    }
    return newNode
  }, [
    nodeTypeIds,
    reactFlowInstance,
    reactFlowRenderer,
    organizationId,
    setNodeDataToChange,
  ])

  const formFunctionNode = useCallback(
    (
      newNodeId: string,
      functionTypeId: string,
      inputNodes: Node[],
      outputNode: Node
    ) => {
      const newNodeType = 'function'
      const newNodeTypeId = nodeTypeIds[newNodeType]
      if (!newNodeTypeId) {
        throw new Error(`Could not find node type id for ${newNodeType}`)
      }

      const centerBetween = inputNodes.concat(outputNode)
      let x = 0
      let y = 0
      centerBetween.forEach((node) => {
        if (!node.width) {
          throw new Error(`Node ${node.id} has no width`)
        }
        if (!node.height) {
          throw new Error(`Node ${node.id} has no height`)
        }
        x += node.position.x + node.width / 2
        y += node.position.y + node.height / 2
      })
      x /= centerBetween.length
      y /= centerBetween.length

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const outputWidth = outputNode.width! // width exists because we checked for it above
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const outputHeight = outputNode.height!
      const width = (outputWidth / 16) * 4 // perhaps there's a better way to link this to stylesheet?
      const height = (outputHeight / 9) * 4
      x -= width / 2
      y -= height / 2

      const newNodeData: FunctionNodeProperties = {
        id: newNodeId, // needed for setNodeDataToChange
        organizationId: organizationId,
        typeId: newNodeTypeId,
        functionTypeId: functionTypeId,
        color: '#FFFFFF',
        initialProperties: {},
        setNodeDataToChange: setNodeDataToChange,
      }
      const newNode: Node = {
        id: newNodeId,
        data: newNodeData,
        type: newNodeType,
        position: {
          x: x,
          y: y,
        },
        width: width,
        height: height,
      }
      return newNode
    },
    [nodeTypeIds, organizationId, setNodeDataToChange]
  )

  const [functionTypeIdsAndSymbols, setFunctionTypeIdsAndSymbols] = useState<{
    [functionId: string]: string
  }>({})
  useEffect(() => {
    const fetchFunctionTypeIdsAndSymbols = async () => {
      try {
        const { data, error, status } = await supabase
          .from('function_types')
          .select('id, symbol')
          .is('deleted_at', null)

        if (error && status !== 406) {
          throw error
        }

        if (!data) {
          throw new Error('No function types returned')
        }

        const _functionTypeIdsAndSymbols: { [key: string]: string } = {}
        data.forEach((functionType: { id: string; symbol: string }) => {
          _functionTypeIdsAndSymbols[functionType.id] = functionType.symbol
        })
        setFunctionTypeIdsAndSymbols(_functionTypeIdsAndSymbols)
      } catch (error) {
        console.error(error)
      }
    }
    fetchFunctionTypeIdsAndSymbols()
  }, [])

  const getFunctionSymbol = useCallback(
    (functionTypeId: string): string => {
      return functionTypeIdsAndSymbols[functionTypeId] || '?'
    },
    [functionTypeIdsAndSymbols]
  )

  const getNearestHandlePair = (source: Node, target: Node) => {
    const handlePairs = [
      {
        source: {
          name: 'top',
          position: {
            x: source.position.x + (source.width || 0) / 2,
            y: source.position.y,
          } as XYPosition,
        },
        target: {
          name: 'bottom',
          position: {
            x: target.position.x + (target.width || 0) / 2,
            y: target.position.y + (target.height || 0),
          } as XYPosition,
        },
      },
      {
        source: {
          name: 'right',
          position: {
            x: source.position.x + (source.width || 0),
            y: source.position.y + (source.height || 0) / 2,
          } as XYPosition,
        },
        target: {
          name: 'left',
          position: {
            x: target.position.x,
            y: target.position.y + (target.height || 0) / 2,
          } as XYPosition,
        },
      },
      {
        source: {
          name: 'bottom',
          position: {
            x: source.position.x + (source.width || 0) / 2,
            y: source.position.y + (source.height || 0),
          } as XYPosition,
        },
        target: {
          name: 'top',
          position: {
            x: target.position.x + (target.width || 0) / 2,
            y: target.position.y,
          } as XYPosition,
        },
      },
      {
        source: {
          name: 'left',
          position: {
            x: source.position.x,
            y: source.position.y + (source.height || 0) / 2,
          } as XYPosition,
        },
        target: {
          name: 'right',
          position: {
            x: target.position.x + (target.width || 0),
            y: target.position.y + (target.height || 0) / 2,
          } as XYPosition,
        },
      },
    ]

    let minDistance = Number.MAX_VALUE
    let sourceHandle = ''
    let targetHandle = ''
    for (const handlePair of handlePairs) {
      const sourceHandlePosition = handlePair.source.position
      const targetHandlePosition = handlePair.target.position
      const distance = Math.sqrt(
        Math.pow(sourceHandlePosition.x - targetHandlePosition.x, 2) +
          Math.pow(sourceHandlePosition.y - targetHandlePosition.y, 2)
      )
      if (distance < minDistance) {
        minDistance = distance
        sourceHandle = handlePair.source.name + '_source' // convention must align custom Node definitions
        targetHandle = handlePair.target.name + '_target'
      }
    }
    return { sourceHandle, targetHandle }
  }

  const formInputEdge = useCallback(
    (
      source: Node,
      target: Node,
      displaySource: Node | undefined = undefined,
      displayTarget: Node | undefined = undefined
    ) => {
      const newEdgeType = 'input'
      const newEdgeTypeId = edgeTypeIds[newEdgeType]
      if (!newEdgeTypeId) {
        throw new Error(`Could not find edge type id for ${newEdgeType}`)
      }

      displaySource = displaySource || source
      displayTarget = displayTarget || target
      const { sourceHandle, targetHandle } = getNearestHandlePair(
        displaySource,
        displayTarget
      )

      const newEdgeId = uuidv4()
      const newEdgeData: InputEdgeProperties = {
        id: newEdgeId,
        organizationId: organizationId,
        typeId: newEdgeTypeId,
        sourceId: source.id,
        targetId: target.id,
        initialProperties: {},
      }
      const newEdge: Edge = {
        source: displaySource.id,
        target: displayTarget.id,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: newEdgeType,
        id: newEdgeId,
        data: newEdgeData,
        animated: true,
      }
      return newEdge
    },
    [edgeTypeIds, organizationId]
  )

  const getConnectedObjects = useCallback(
    (
      reference: Node | Edge,
      maxSeparationDegrees?: number,
      direction?: 'inputs' | 'outputs',
      connectedObjects: (Node | Edge)[] = []
    ) => {
      if (direction === undefined) {
        connectedObjects = connectedObjects.concat(
          getConnectedObjects(
            reference,
            maxSeparationDegrees,
            'inputs',
            connectedObjects
          )
        )
        connectedObjects = connectedObjects.concat(
          getConnectedObjects(
            reference,
            maxSeparationDegrees,
            'outputs',
            connectedObjects
          )
        )
      } else {
        if (reference.data.sourceId && reference.data.targetId) {
          // reference is edge
          // select connected nodes
          graph.nodes.forEach((node) => {
            if (
              ((node.id === reference.data.sourceId &&
                direction === 'inputs') ||
                (node.id === reference.data.targetId &&
                  direction === 'outputs')) &&
              !connectedObjects.includes(node)
            ) {
              connectedObjects.push(node)
              if (
                maxSeparationDegrees !== undefined &&
                ['custom', 'metric'].includes(node.type || '')
              ) {
                maxSeparationDegrees -= 1
              }
              if (
                maxSeparationDegrees === undefined ||
                maxSeparationDegrees > 0
              ) {
                connectedObjects = getConnectedObjects(
                  node,
                  maxSeparationDegrees,
                  direction,
                  connectedObjects
                )
              }
            }
          })
        } else {
          // reference is node
          // select connected edges
          graph.edges.forEach((edge) => {
            if (
              ((edge.data.sourceId === reference.id &&
                direction === 'outputs') ||
                (edge.data.targetId === reference.id &&
                  direction === 'inputs')) &&
              !connectedObjects.includes(edge)
            ) {
              connectedObjects.push(edge)
              connectedObjects = getConnectedObjects(
                edge,
                maxSeparationDegrees,
                direction,
                connectedObjects
              )
            }
          })
        }
      }
      // dedupe
      connectedObjects = connectedObjects.filter(
        (item, index) => connectedObjects.indexOf(item) === index
      )
      return connectedObjects
    },
    [graph]
  )

  const value = {
    initialGraph: initialGraph,
    graph: graph,
    goalStatusMap: goalStatusMap,
    setGoalStatusMap: setGoalStatusMap,
    latestCommentIdMap: latestCommentIdMap,
    setLatestCommentIdMap: setLatestCommentIdMap,
    reactFlowInstance: reactFlowInstance,
    setReactFlowInstance: setReactFlowInstance,
    reactFlowRenderer: reactFlowRenderer,
    setReactFlowRenderer: setReactFlowRenderer,
    reactFlowViewport: reactFlowViewport,
    setReactFlowViewport: setReactFlowViewport,
    initialGraphFitComplete: initialGraphFitComplete,
    setInitialGraphFitComplete: setInitialGraphFitComplete,
    nodeShouldRender: nodeShouldRender,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    loadGraph: loadGraph,
    saveGraph: saveGraph,
    updateGraph: updateGraph,
    setNodeDataToChange: setNodeDataToChange,
    setEdgeBeingUpdated: setEdgeBeingUpdated,
    formNodeHandleStyle: formNodeHandleStyle,
    formCustomNode: formCustomNode,
    formMetricNode: formMetricNode,
    formFunctionNode: formFunctionNode,
    getFunctionSymbol: getFunctionSymbol,
    formInputEdge: formInputEdge,
    getConnectedObjects: getConnectedObjects,
  }
  return (
    <>
      <GraphContext.Provider value={value}>{children}</GraphContext.Provider>
    </>
  )
}
