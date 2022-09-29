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
import { Edge, Node, XYPosition } from 'react-flow-renderer'
import useUndoable from 'use-undoable'
import { v4 as uuidv4 } from 'uuid'

import FunctionNode, {
  FunctionNodeProperties,
} from '../components/graph/FunctionNode'
import InputEdge, { InputEdgeProperties } from '../components/graph/InputEdge'
import MetricNode, {
  MetricNodeProperties,
} from '../components/graph/MetricNode'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './auth'

export const nodeTypes = {
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
type QueryParameterValues = {
  userRecordId: string
  userValue: string // what is in effect for the user and injected into queries
  orgDefaultRecordId: string
  orgDefaultValue: string // used if no overriding user-specific record
}

type GraphContextType = {
  initialGraph: Graph
  graph: Graph
  /* reactFlowInstance is produced by useReactFlow(), which must be called
    in a component that is wrapped in a ReactFlowProvider. Thus, we can't
    instantiate it directly here but instead pass it back from GraphViewer. */
  setReactFlowInstance: Dispatch<SetStateAction<any>> | undefined
  undo: (() => void) | undefined
  redo: (() => void) | undefined
  canUndo: boolean
  canRedo: boolean
  loadGraph: (() => Promise<void>) | undefined
  saveGraph: (() => Promise<Response | undefined>) | undefined
  updateGraph:
    | ((t: 'all' | 'nodes' | 'edges', v: Array<any>, undoable: boolean) => void)
    | undefined
  setNodeDataToChange:
    | Dispatch<
        SetStateAction<
          MetricNodeProperties | FunctionNodeProperties | undefined
        >
      >
    | undefined
  formMetricNode: (() => Node<any>) | undefined
  formFunctionNode:
    | ((
        newNodeId: string,
        functionTypeId: string,
        inputNodes: Node[],
        outputNode: Node
      ) => Node<any>)
    | undefined
  formInputEdge:
    | ((
        source: Node,
        target: Node,
        displaySource?: Node | undefined,
        displayTarget?: Node | undefined
      ) => Edge<any>)
    | undefined
  getConnectedObjects:
    | ((
        reference: Node | Edge,
        calledFrom?: string
      ) => (Node<any> | Edge<any>)[])
    | undefined
  getInputNodes: ((node: Node) => Node[]) | undefined
  globalQueryRefreshes: number
  setGlobalQueryRefreshes: Dispatch<SetStateAction<number>> | undefined
  queryParameters: {
    [name: string]: QueryParameterValues
  }
  initializeQueryParameter: ((name: string) => void) | undefined
  resetQueryParameterUserValue: ((name: string) => Promise<void>) | undefined
  setQueryParameterUserValue:
    | ((name: string, value: string) => Promise<void>)
    | undefined
  setQueryParameterOrgDefaultValue:
    | ((name: string, value: string) => Promise<void>)
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
  setReactFlowInstance: undefined,
  undo: undefined,
  redo: undefined,
  canUndo: false,
  canRedo: false,
  loadGraph: undefined,
  saveGraph: undefined,
  updateGraph: undefined,
  setNodeDataToChange: undefined,
  formMetricNode: undefined,
  formFunctionNode: undefined,
  formInputEdge: undefined,
  getConnectedObjects: undefined,
  getInputNodes: undefined,
  globalQueryRefreshes: 0,
  setGlobalQueryRefreshes: undefined,
  queryParameters: {},
  initializeQueryParameter: undefined,
  resetQueryParameterUserValue: undefined,
  setQueryParameterUserValue: undefined,
  setQueryParameterOrgDefaultValue: undefined,
}

const GraphContext = createContext<GraphContextType>(graphContextDefaultValues)

export function useGraph() {
  return useContext(GraphContext)
}

type GraphProps = {
  children: ReactNode
}

export function GraphProvider({ children }: GraphProps) {
  const { session, organizationId } = useAuth()

  const [initialGraph, setInitialGraph] = useState<Graph>({
    nodes: [],
    edges: [],
  })
  const [graph, setGraph, { undo, redo, canUndo, canRedo, reset }] =
    useUndoable<Graph>(initialGraph, {
      behavior: 'destroyFuture',
      ignoreIdenticalMutations: false,
    })

  const [reactFlowInstance, setReactFlowInstance] = useState<any>()

  const [nodeTypeIds, setNodeTypeIds] = useState<TypeIdMap>(
    Object.fromEntries(Object.keys(nodeTypes).map((key) => [key, '']))
  )
  async function getNodeTypeIds() {
    try {
      let { data, error, status } = await supabase
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
    } catch (error: any) {
      alert(error.message)
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
      let { data, error, status } = await supabase
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
    } catch (error: any) {
      alert(error.message)
    }
  }
  useEffect(() => {
    getEdgeTypeIds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadGraph = useCallback(async () => {
    if (organizationId) {
      try {
        let { data: nodesData, error: nodesError } = await supabase
          .from('nodes')
          .select('properties, react_flow_meta')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)

        if (nodesError) {
          throw nodesError
        }

        let { data: edgesData, error: edgesError } = await supabase
          .from('edges')
          .select('properties, react_flow_meta')
          .eq('organization_id', organizationId)
          .is('deleted_at', null)

        if (edgesError) {
          throw edgesError
        }

        if (nodesData && edgesData) {
          const parsedNodes = nodesData.map((n) => {
            let parsedNode = n.react_flow_meta
            const parsedProperties = n.properties
            if (parsedNode.type === 'metric') {
              parsedNode.data = {
                // explicit construction so properties added outside of react flow don't break it
                id: parsedProperties.id,
                organizationId: parsedProperties.organizationId,
                typeId: parsedProperties.typeId,
                name: parsedProperties.name,
                description: parsedProperties.description,
                owner: parsedProperties.owner,
                sourceCode: parsedProperties.sourceCode,
                sourceDatabaseConnectionId:
                  parsedProperties.sourceDatabaseConnectionId,
                color: parsedProperties.color,
                initialProperties: parsedProperties,
                setNodeDataToChange: setNodeDataToChange,
              } as MetricNodeProperties
            }
            if (parsedNode.type === 'function') {
              parsedNode.data = {
                id: parsedProperties.id,
                organizationId: parsedProperties.organizationId,
                typeId: parsedProperties.typeId,
                functionTypeId: parsedProperties.functionTypeId,
                color: parsedProperties.color,
                initialProperties: parsedProperties,
                setNodeDataToChange: setNodeDataToChange,
              } as FunctionNodeProperties
            }
            return parsedNode
          })
          const parsedEdges = edgesData.map((e) => {
            let parsedEdge = e.react_flow_meta
            const parsedProperties = e.properties
            parsedEdge.data = {
              id: parsedProperties.id,
              organizationId: parsedProperties.organizationId,
              typeId: parsedProperties.typeId,
              sourceId: parsedProperties.sourceId,
              targetId: parsedProperties.targetId,
              initialProperties: parsedProperties,
            } as InputEdgeProperties
            return parsedEdge
          })
          const parsedGraph = {
            nodes: parsedNodes,
            edges: parsedEdges,
          }
          setInitialGraph(parsedGraph)
          reset(parsedGraph)
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }, [organizationId, reset])
  useEffect(() => {
    if (loadGraph) {
      loadGraph()
    }
  }, [loadGraph])

  const saveGraph = useCallback(async () => {
    const accessToken = session?.access_token
    if (!accessToken) {
      return
    }
    // remove selections
    graph.nodes = graph.nodes.map((n) => ({ ...n, selected: false }))
    graph.edges = graph.edges.map((e) => ({ ...e, selected: false }))

    return fetch('/api/v1/graphs', {
      method: 'PUT',
      body: JSON.stringify({
        initialGraph: initialGraph,
        updatedGraph: graph,
      }),
      headers: {
        'supabase-access-token': accessToken,
      },
    })
  }, [session, graph, initialGraph])

  const updateGraph = useCallback(
    (t: 'all' | 'nodes' | 'edges', v: Array<any>, undoable: boolean) => {
      // To prevent a mismatch of state updates,
      // we'll use the value passed into this
      // function instead of the state directly.
      setGraph(
        t === 'all' // pretty hacky but it's good enough for now
          ? v[0]
          : (e) => ({
              nodes: t === 'nodes' ? v : e.nodes,
              edges: t === 'edges' ? v : e.edges,
            }),
        undefined,
        !undoable
      )
    },
    [setGraph]
  )

  /* ideally we'd use a callback for this, but I don't think it's currently possible
  https://github.com/wbkd/react-flow/discussions/2270 */
  const [nodeDataToChange, setNodeDataToChange] = useState<
    MetricNodeProperties | FunctionNodeProperties
  >()
  useEffect(() => {
    if (nodeDataToChange) {
      const nodeToChangeId = nodeDataToChange.id
      const nodeToChange = graph.nodes.find((n) => n.id === nodeToChangeId)
      const otherNodes = graph.nodes.filter((n) => n.id !== nodeToChangeId)
      if (nodeToChange) {
        let nodeToChangeClone = JSON.parse(JSON.stringify(nodeToChange)) // so updateGraph detects a change
        nodeToChangeClone.data = nodeDataToChange
        updateGraph('nodes', otherNodes.concat(nodeToChangeClone), true)
      }
      setNodeDataToChange(undefined) // avoid infinite loop
    }
  }, [nodeDataToChange, setNodeDataToChange, updateGraph, graph.nodes])

  const formMetricNode = useCallback(() => {
    const newNodeType = 'metric'
    const newNodeTypeId = nodeTypeIds[newNodeType]
    if (!newNodeTypeId) {
      throw new Error(`Could not find node type id for ${newNodeType}`)
    }

    const rfRendererElement = document.querySelector('.react-flow__renderer')!
    const { x, y } =
      reactFlowInstance && reactFlowInstance.project
        ? reactFlowInstance.project({
            x: rfRendererElement.clientWidth / 2,
            y: rfRendererElement.clientHeight / 2,
          })
        : { x: 0, y: 0 }
    const newNodeId = uuidv4()
    const newNodeData: MetricNodeProperties = {
      id: newNodeId, // needed for setNodeDataToChange
      organizationId: organizationId,
      typeId: newNodeTypeId,
      name: 'New Metric',
      description: '',
      owner: '',
      sourceCode: '',
      sourceDatabaseConnectionId: '',
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
  }, [nodeTypeIds, reactFlowInstance, organizationId, setNodeDataToChange])

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

      const outputWidth = outputNode.width! // width exists because we checked for it above
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
    (reference: Node | Edge, calledFrom: string = '') => {
      let connectedObjects: (Node | Edge)[] = []
      if (
        reference.type === 'function' ||
        // only traverse from metric nodes on first call
        (reference.type === 'metric' && calledFrom === '')
      ) {
        // select connected edges
        graph.edges.forEach((edge) => {
          if (
            (edge.data.sourceId === reference.id ||
              edge.data.targetId === reference.id) &&
            edge.type === 'input' &&
            edge.id !== calledFrom
          ) {
            connectedObjects = connectedObjects.concat(
              [edge],
              getConnectedObjects(edge, reference.id)
            )
          }
        })
      } else if (reference.type === 'input') {
        // select connected function nodes
        graph.nodes.forEach((node) => {
          if (
            (node.id === reference.data.sourceId ||
              node.id === reference.data.targetId) &&
            ['function', 'metric'].includes(node.type || '') &&
            node.id !== calledFrom
          ) {
            connectedObjects = connectedObjects.concat(
              [node],
              getConnectedObjects(node, reference.id)
            )
          }
        })
      }
      return connectedObjects
    },
    [graph]
  )

  const getInputNodes = useCallback(
    (reference: Node) => {
      let inputNodes: Node[] = []
      // select immediate input nodes
      graph.edges.forEach((edge) => {
        if (
          edge.data.targetId === reference.id &&
          edge.type === 'input' &&
          edge.data.sourceId
        ) {
          const inputNode = graph.nodes.find(
            (node) => node.id === edge.data.sourceId
          )
          if (inputNode) {
            inputNodes = inputNodes.concat(
              [inputNode],
              // recursively select input nodes of input nodes
              getInputNodes(inputNode)
            )
          }
        }
      })
      return inputNodes
    },
    [graph]
  )

  const [globalQueryRefreshes, setGlobalQueryRefreshes] = useState(0)

  const [queryParameters, setQueryParameters] = useState<{
    [name: string]: QueryParameterValues
  }>({})

  const initializeQueryParameter = (name: string) => {
    setQueryParameters((prev) => ({
      ...prev,
      [name]: {
        userRecordId: uuidv4(),
        userValue: '',
        orgDefaultRecordId: uuidv4(),
        orgDefaultValue: '',
      },
    }))
  }

  const populateQueryParameters = useCallback(async () => {
    if (organizationId) {
      try {
        let { data, error, status } = await supabase
          .from('database_query_parameters')
          .select('id, user_id, name, value, deleted_at')
          // rls limits to records from user's org where user_id is user's or null
          /* output user's records first, so below logic to overwrite deleted user
            records with org default records will work */
          .order('user_id', { ascending: true })
          // in rare case of multiple org defaults, use first one
          .order('created_at', { ascending: true })

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          // initializing record ids enables upserts to work (idempotently) if there's no existing pg record
          const names = data.map((row) => row.name)
          names.forEach(initializeQueryParameter)
          // populate with real records where available
          data.forEach((row) => {
            if (row.user_id) {
              setQueryParameters((prev) => ({
                ...prev,
                [row.name]: {
                  userRecordId: row.id,
                  userValue: row.deleted_at === null ? row.value : '',
                  orgDefaultRecordId: prev[row.name].orgDefaultRecordId,
                  orgDefaultValue: prev[row.name].orgDefaultValue,
                },
              }))
            } else {
              setQueryParameters((prev) => ({
                ...prev,
                [row.name]: {
                  userRecordId: prev[row.name].userRecordId,
                  userValue: prev[row.name].userValue
                    ? prev[row.name].userValue
                    : row.value,
                  orgDefaultRecordId: row.id,
                  orgDefaultValue: row.value,
                },
              }))
            }
          })
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateQueryParameters()
  }, [populateQueryParameters])

  const resetQueryParameterUserValue = useCallback(
    async (name: string) => {
      let qp = queryParameters[name]
      if (qp) {
        try {
          await supabase
            .from('database_query_parameters')
            .upsert({
              id: qp.userRecordId,
              organization_id: organizationId,
              user_id: session?.user?.id,
              name: name,
              value: qp.userValue,
              updated_at: new Date(),
              deleted_at: new Date(),
            })
            .then(() => {
              qp = {
                ...qp,
                userValue: qp.orgDefaultValue,
              }
              setQueryParameters((prev) => ({
                ...prev,
                [name]: qp,
              }))
              setGlobalQueryRefreshes(globalQueryRefreshes + 1)
            })
        } catch (error: any) {
          alert(error.message)
        }
      }
    },
    [
      queryParameters,
      organizationId,
      session,
      setGlobalQueryRefreshes,
      globalQueryRefreshes,
    ]
  )

  const setQueryParameterUserValue = useCallback(
    async (name: string, value: string) => {
      let qp = queryParameters[name]
      if (qp) {
        if (value === qp.orgDefaultValue) {
          resetQueryParameterUserValue(name)
        } else {
          try {
            await supabase
              .from('database_query_parameters')
              .upsert({
                id: qp.userRecordId,
                organization_id: organizationId,
                user_id: session?.user?.id,
                name: name,
                value: value,
                updated_at: new Date(),
                deleted_at: null,
              })
              .then(() => {
                qp = {
                  ...qp,
                  userValue: value,
                }
                setQueryParameters((prev) => ({
                  ...prev,
                  [name]: qp,
                }))
                setGlobalQueryRefreshes(globalQueryRefreshes + 1)
              })
          } catch (error: any) {
            alert(error.message)
          }
        }
      }
    },
    [
      queryParameters,
      resetQueryParameterUserValue,
      organizationId,
      session,
      setGlobalQueryRefreshes,
      globalQueryRefreshes,
    ]
  )

  const setQueryParameterOrgDefaultValue = useCallback(
    async (name: string, value: string) => {
      let qp = queryParameters[name]
      if (qp) {
        try {
          await supabase
            .from('database_query_parameters')
            .upsert([
              {
                id: qp.orgDefaultRecordId,
                organization_id: organizationId,
                user_id: null,
                name: name,
                value: value,
                updated_at: new Date(),
                deleted_at: null,
              },
              {
                id: qp.userRecordId,
                organization_id: organizationId,
                user_id: session?.user?.id,
                name: name,
                value: qp.userValue,
                updated_at: new Date(),
                deleted_at: new Date(),
              },
            ])
            .then(() => {
              qp = {
                ...qp,
                orgDefaultValue: value,
                userValue: value,
              }
              setQueryParameters((prev) => ({
                ...prev,
                [name]: qp,
              }))
              setGlobalQueryRefreshes(globalQueryRefreshes + 1)
            })
        } catch (error: any) {
          alert(error.message)
        }
      }
    },
    [
      queryParameters,
      organizationId,
      session,
      setGlobalQueryRefreshes,
      globalQueryRefreshes,
    ]
  )

  const value = {
    initialGraph: initialGraph,
    graph: graph,
    setReactFlowInstance: setReactFlowInstance,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo,
    loadGraph: loadGraph,
    saveGraph: saveGraph,
    updateGraph: updateGraph,
    setNodeDataToChange: setNodeDataToChange,
    formMetricNode: formMetricNode,
    formFunctionNode: formFunctionNode,
    formInputEdge: formInputEdge,
    getConnectedObjects: getConnectedObjects,
    getInputNodes: getInputNodes,
    globalQueryRefreshes: globalQueryRefreshes,
    setGlobalQueryRefreshes: setGlobalQueryRefreshes,
    queryParameters: queryParameters,
    initializeQueryParameter: initializeQueryParameter,
    resetQueryParameterUserValue: resetQueryParameterUserValue,
    setQueryParameterUserValue: setQueryParameterUserValue,
    setQueryParameterOrgDefaultValue: setQueryParameterOrgDefaultValue,
  }
  return (
    <>
      <GraphContext.Provider value={value}>{children}</GraphContext.Provider>
    </>
  )
}
