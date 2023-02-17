import {
  PostgrestError,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'
import _ from 'lodash'
import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  CUSTOM_NODE_INIT_HEIGHT,
  CUSTOM_NODE_INIT_WIDTH,
  CustomNodeProperties,
  CustomNodeSource,
} from 'components/graph/CustomNode'
import FunctionNode, {
  FUNCTION_NODE_INIT_HEIGHT,
  FUNCTION_NODE_INIT_WIDTH,
  FunctionNodeProperties,
} from 'components/graph/FunctionNode'
import InputEdge, { InputEdgeProperties } from 'components/graph/InputEdge'
import MetricNode, {
  METRIC_NODE_INIT_HEIGHT,
  METRIC_NODE_INIT_WIDTH,
  MetricNodeProperties,
} from 'components/graph/MetricNode'
import { GoalStatus } from 'components/graph/node_detail/GoalsTable'
import { useAuth } from 'contexts/auth'
import { useEditability } from 'contexts/editability'
import { getLastUpdatedAt } from 'utils/queryUtils'
import { supabase } from 'utils/supabaseClient'

export const NODE_TYPES = {
  custom: CustomNode,
  metric: MetricNode,
  function: FunctionNode,
}
export const EDGE_TYPES = {
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
  updateGraph:
    | ((
        update: { nodes: Node[] | undefined; edges: Edge[] | undefined },
        undoable: boolean,
        forceSave?: boolean
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
  const { session, getValidAccessToken, organizationId, userOnMobile } =
    useAuth()
  const { editingEnabled } = useEditability()

  const [initialGraph, setInitialGraph] = useState<Graph>({
    nodes: [],
    edges: [],
  })
  const [graph, setGraph, { canUndo, canRedo, past, future, reset }] =
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
    Object.fromEntries(Object.keys(NODE_TYPES).map((key) => [key, '']))
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
        const nodeTypes = data as {
          name: string
          id: string
        }[]
        const _nodeTypeIds = {} as TypeIdMap
        for (const nodeTypeName in nodeTypeIds) {
          const nodeTypeId = nodeTypes.find((n) => n.name === nodeTypeName)?.id
          if (nodeTypeId) {
            _nodeTypeIds[nodeTypeName] = nodeTypeId
          } else {
            throw new Error(`Could not find node type id for ${nodeTypeName}`)
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
    Object.fromEntries(Object.keys(EDGE_TYPES).map((key) => [key, '']))
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
        const edgeTypes = data as {
          name: string
          id: string
        }[]
        const _edgeTypeIds = {} as TypeIdMap
        for (const edgeTypeName in edgeTypeIds) {
          const edgeTypeId = edgeTypes.find((e) => e.name === edgeTypeName)?.id
          if (edgeTypeId) {
            _edgeTypeIds[edgeTypeName] = edgeTypeId
          } else {
            throw new Error(`Could not find edge type id for ${edgeTypeName}`)
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
  const [everLoadedIds, setEverLoadedIds] = useState<Set<string>>(new Set())
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
            setEverLoadedIds((prev) => {
              return new Set([
                ...Array.from(prev),
                ..._graph.nodes.map((node) => node.id),
                ..._graph.edges.map((edge) => edge.id),
              ])
            })
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

  type NodeOrEdge = Node | Edge
  type NodeOrEdgeArray = NodeOrEdge[]
  const determineNodeOrEdgeType = useCallback((object: NodeOrEdge): string => {
    return 'source' in object && 'target' in object ? 'edge' : 'node'
  }, [])
  const nodeOrEdgeArrayIsUniform = useCallback(
    (objects: NodeOrEdgeArray): boolean => {
      if (objects.length === 0) {
        return true
      } else {
        const firstObjectType = determineNodeOrEdgeType(objects[0])
        return objects.every(
          (object) => determineNodeOrEdgeType(object) === firstObjectType
        )
      }
    },
    [determineNodeOrEdgeType]
  )

  const upsertNodesOrEdges = useCallback(
    async (
      objects: NodeOrEdgeArray,
      op: 'create' | 'delete' | 'update'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<PostgrestError | null> => {
      if (!nodeOrEdgeArrayIsUniform(objects)) {
        throw new Error('Cannot upsert nodes and edges in the same request')
      }
      const userId = session?.user?.id
      if (!userId) {
        throw new Error('User not logged in')
      }
      type Record = {
        id: string
        organization_id: string
        type_id: string
        properties: object
        react_flow_meta: object
        updated_at: Date
        updated_by: string
        deleted_at: Date | null
        deleted_by: string | null
        source_id?: string // only edges have source_id
        target_id?: string // only edges have target_id
        created_at?: Date // only needed for create
        created_by?: string // only needed for create
      }
      const recordType = determineNodeOrEdgeType(objects[0])
      const currentDate = new Date()
      const records: Record[] = objects.map((object) => {
        const { data, ...reactFlowMeta } = object
        const recordId = data.id
        let record: Record = {
          id: recordId,
          organization_id: data.organizationId,
          type_id: data.typeId,
          properties: data,
          react_flow_meta: reactFlowMeta,
          updated_at: currentDate,
          updated_by: userId,
          deleted_at: null,
          deleted_by: null,
        }
        if (recordType === 'edge') {
          record = {
            ...record,
            source_id: data.sourceId,
            target_id: data.targetId,
          }
        }
        if (op === 'create' && !everLoadedIds.has(recordId)) {
          record = {
            ...record,
            created_at: currentDate,
            created_by: userId,
          }
        }
        if (op === 'delete') {
          record = {
            ...record,
            deleted_at: currentDate,
            deleted_by: userId,
          }
        }
        return record
      })
      const { error } = await supabase.from(`${recordType}s`).upsert(records)
      return error
    },
    [
      nodeOrEdgeArrayIsUniform,
      session?.user?.id,
      determineNodeOrEdgeType,
      everLoadedIds,
    ]
  )

  const processNodesOrEdges = useCallback(
    async (
      initialObjects: NodeOrEdgeArray,
      updatedObjects: NodeOrEdgeArray
    ): Promise<{
      errors: PostgrestError[]
      deletedObjects: NodeOrEdgeArray
    }> => {
      if (!nodeOrEdgeArrayIsUniform(initialObjects.concat(updatedObjects))) {
        throw new Error('Cannot process nodes and edges in the same request')
      }
      const errors: PostgrestError[] = []

      const addedObjects: NodeOrEdgeArray = updatedObjects.filter(
        (updatedObject: Edge | Node) =>
          !initialObjects.find(
            (initialObject: Edge | Node) =>
              initialObject.id === updatedObject.id
          )
      )
      if (addedObjects.length > 0) {
        const addedObjectsError = await upsertNodesOrEdges(
          addedObjects,
          'create'
        )
        if (addedObjectsError) {
          errors.push(addedObjectsError)
        }
      }

      const modifiedObjects = updatedObjects.filter((updatedObject) => {
        const initialObject = initialObjects.find(
          (initialObject) => initialObject.id === updatedObject.id
        )
        return initialObject && !_.isEqual(initialObject, updatedObject)
      })
      if (modifiedObjects.length > 0) {
        const modifiedObjectsError = await upsertNodesOrEdges(
          modifiedObjects,
          'update'
        )
        if (modifiedObjectsError) {
          errors.push(modifiedObjectsError)
        }
      }

      const deletedObjects = initialObjects.filter(
        (initialObject) =>
          !updatedObjects.find(
            (updatedObject) => updatedObject.id === initialObject.id
          )
      )
      if (deletedObjects.length > 0) {
        const deletedObjectsError = await upsertNodesOrEdges(
          deletedObjects,
          'delete'
        )
        if (deletedObjectsError) {
          errors.push(deletedObjectsError)
        }
      }

      return { errors, deletedObjects }
    },
    [nodeOrEdgeArrayIsUniform, upsertNodesOrEdges]
  )

  const saveGraph = useCallback(
    async (initialGraph: Graph, updatedGraph: Graph) => {
      const upsertErrors: PostgrestError[] = []

      const resetNodeOrEdge: (object: Node | Edge) => Node | Edge = (
        object
      ) => {
        let newObject = {
          ...object,
          selected: false,
        }
        if (determineNodeOrEdgeType(object) === 'node') {
          newObject = {
            ...newObject,
            dragging: false,
          }
        }
        return newObject
      }

      // process nodes
      const initialNodes = initialGraph.nodes.map(resetNodeOrEdge)
      const updatedNodes = updatedGraph.nodes.map(resetNodeOrEdge)
      const { errors: nodeErrors, deletedObjects: deletedNodes } =
        await processNodesOrEdges(initialNodes, updatedNodes)
      upsertErrors.push(...nodeErrors)

      // process edges
      const initialEdges = initialGraph.edges.map(resetNodeOrEdge)
      const updatedEdges = updatedGraph.edges
        .filter(
          // delete any edges connected to deleted nodes
          (initialEdge) =>
            !deletedNodes.find(
              (deletedNode) =>
                deletedNode.id === initialEdge.source ||
                deletedNode.id === initialEdge.target
            )
        )
        .map(resetNodeOrEdge)
      const { errors: edgeErrors } = await processNodesOrEdges(
        initialEdges,
        updatedEdges
      )
      upsertErrors.push(...edgeErrors)

      // reset initial graph
      if (upsertErrors.length === 0) {
        setInitialGraph(updatedGraph)
      } else {
        console.error(upsertErrors)
      }
    },
    [determineNodeOrEdgeType, processNodesOrEdges]
  )

  const [saveGraphTimeout, setSaveGraphTimeout] = useState<NodeJS.Timeout>()
  const updateGraph = useCallback(
    (
      update: { nodes: Node[] | undefined; edges: Edge[] | undefined },
      undoable: boolean,
      forceSave?: boolean
    ) => {
      const updatedGraph = {
        nodes: update.nodes || graph.nodes,
        edges: update.edges || graph.edges,
      } as Graph
      setGraph(updatedGraph, undefined, !undoable)
      if (undoable || forceSave) {
        if (!editingEnabled) return // safety
        clearTimeout(saveGraphTimeout)
        setSaveGraphTimeout(
          setTimeout(() => {
            saveGraph(initialGraph, updatedGraph)
          }, 1000)
        )
      }
    },
    [graph, setGraph, editingEnabled, saveGraphTimeout, saveGraph, initialGraph]
  )

  // homebrewed undo/redo to support simultaneous saveGraph
  const undo = useCallback(() => {
    if (canUndo && past.length > 0) {
      const lastGraph = past.pop()
      if (lastGraph) {
        saveGraph(graph, lastGraph)
        future.push(graph)
        setGraph(lastGraph, undefined, true)
      }
    }
  }, [canUndo, past, saveGraph, graph, setGraph, future])
  const redo = useCallback(() => {
    if (canRedo && future.length > 0) {
      const nextGraph = future.pop()
      if (nextGraph) {
        saveGraph(graph, nextGraph)
        past.push(graph)
        setGraph(nextGraph, undefined, true)
      }
    }
  }, [canRedo, future, saveGraph, graph, setGraph, past])

  // avoid causing subscription unmounts below
  const setGraphRef = useRef(setGraph)
  useEffect(() => {
    setGraphRef.current = setGraph
  }, [setGraph])
  const pastRef = useRef(past)
  useEffect(() => {
    pastRef.current = past
  }, [past])
  const futureRef = useRef(future)
  useEffect(() => {
    futureRef.current = future
  }, [future])

  // listen for graph changes
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payloadQueue: RealtimePostgresChangesPayload<any>[] = []
    const ignoreNodeOrEdgesPayload = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: RealtimePostgresChangesPayload<any>
    ) =>
      // ignore active-window payloads (but below still intended to be idempotent)
      payload.new.updated_by === session?.user?.id && document.hasFocus()
    const upsertNodesOrEdgesPayload: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: RealtimePostgresChangesPayload<any>,
      graph: Graph
    ) => Graph = (payload, graph) => {
      const nodesOrEdges = payload.table as 'nodes' | 'edges'
      let toUpsertData = {
        ...payload.new.properties,
      }
      if (nodesOrEdges === 'nodes') {
        toUpsertData = {
          ...toUpsertData,
          setNodeDataToChange: setNodeDataToChange,
        }
      }
      const toUpsert = {
        ...payload.new.react_flow_meta,
        data: toUpsertData,
      }
      setEverLoadedIds((prev) => {
        const newSet = new Set(prev)
        newSet.add(payload.new.id)
        return newSet
      })
      if (graph[nodesOrEdges].some((n) => n.id === toUpsert.id)) {
        return {
          ...graph,
          [nodesOrEdges]: graph[nodesOrEdges].map((n) =>
            n.id === toUpsert.id
              ? {
                  ...toUpsert,
                  selected: n.selected,
                }
              : n
          ),
        } as Graph
      } else {
        return {
          ...graph,
          [nodesOrEdges]: [...graph[nodesOrEdges], toUpsert],
        } as Graph
      }
    }
    const deleteNodesOrEdgesPayload: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: RealtimePostgresChangesPayload<any>,
      graph: Graph
    ) => Graph = (payload, graph) => {
      const nodesOrEdges = payload.table as 'nodes' | 'edges'
      const old = payload.old as {
        id: string
      }
      return {
        ...graph,
        // simpler filter yields ts(2349) error
        [nodesOrEdges]: graph[nodesOrEdges]
          .map((n) => (n.id === old.id ? null : n))
          .filter((n) => n !== null),
      } as Graph
    }
    const processPayloadQueue = () => {
      const migrateGraph: (graph: Graph) => Graph = (graph) => {
        let newGraph = graph
        payloadQueue.forEach((payload) => {
          if (
            payload.eventType === 'INSERT' ||
            (payload.eventType === 'UPDATE' && !payload.new.deleted_at)
          ) {
            newGraph = upsertNodesOrEdgesPayload(payload, newGraph)
          } else if (payload.eventType === 'UPDATE') {
            newGraph = deleteNodesOrEdgesPayload(payload, newGraph)
          }
        })
        return newGraph
      }
      setInitialGraph(migrateGraph)
      setGraphRef.current((graph) => migrateGraph(graph), undefined, true)
      pastRef.current.forEach((graph, i) => {
        pastRef.current[i] = migrateGraph(graph)
      })
      futureRef.current.forEach((graph, i) => {
        futureRef.current[i] = migrateGraph(graph)
      })
      payloadQueue = []
    }
    const processPayloadQueueDebounced = _.debounce(processPayloadQueue, 300)
    const handleNodesOrEdgesPayload: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: RealtimePostgresChangesPayload<any>
    ) => void = (payload) => {
      if (ignoreNodeOrEdgesPayload(payload)) return
      payloadQueue.push(payload)
      processPayloadQueueDebounced()
    }
    const nodesSubscription = supabase
      .channel('public:nodes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nodes' },
        handleNodesOrEdgesPayload
      )
      .subscribe()
    const edgesSubscription = supabase
      .channel('public:edges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'edges' },
        handleNodesOrEdgesPayload
      )
      .subscribe()
    const monitoringRuleEvalsSubscription = supabase
      .channel('public:monitoring_rule_evaluations')
      .on(
        'postgres_changes',
        // inserts are pending, status comes through via update
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'monitoring_rule_evaluations',
        },
        async (payload) => {
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
            const monitoringRule = data as {
              parent_node_id: string
            }
            // update node in graph
            const updateParentNode: (graph: Graph) => Graph = (graph) => {
              return {
                nodes: graph.nodes.map((n) => {
                  if (n.id === monitoringRule.parent_node_id) {
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
                edges: graph.edges,
              }
            }
            setInitialGraph(updateParentNode)
            setGraphRef.current(updateParentNode, undefined, true)
            pastRef.current.forEach((graph, i) => {
              pastRef.current[i] = updateParentNode(graph)
            })
            futureRef.current.forEach((graph, i) => {
              futureRef.current[i] = updateParentNode(graph)
            })
          }
        }
      )
      .subscribe()
    const commentsSubscription = supabase
      .channel('public:sce_comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sce_comments' },
        (payload) => {
          const comment = payload.new
          setLatestCommentIdMap((latestCommentIdMap) => {
            return {
              ...latestCommentIdMap,
              [comment.topic]: comment.id,
            }
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(nodesSubscription)
      supabase.removeChannel(edgesSubscription)
      supabase.removeChannel(monitoringRuleEvalsSubscription)
      supabase.removeChannel(commentsSubscription)
    }
  }, [session?.user?.id])

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
      height: CUSTOM_NODE_INIT_HEIGHT,
      width: CUSTOM_NODE_INIT_WIDTH,
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
      height: METRIC_NODE_INIT_HEIGHT,
      width: METRIC_NODE_INIT_WIDTH,
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

      const width = FUNCTION_NODE_INIT_WIDTH
      const height = FUNCTION_NODE_INIT_HEIGHT
      x -= width / 2
      y -= height / 2

      const newNodeData: FunctionNodeProperties = {
        id: newNodeId, // needed for setNodeDataToChange
        organizationId: organizationId,
        typeId: newNodeTypeId,
        functionTypeId: functionTypeId,
        color: '#FFFFFF',
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
        const functionTypes = data as { id: string; symbol: string }[]
        const _functionTypeIdsAndSymbols: { [key: string]: string } = {}
        functionTypes.forEach((functionType) => {
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
