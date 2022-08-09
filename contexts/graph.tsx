import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'
import { Edge, Node, XYPosition } from 'react-flow-renderer'
import useUndoable from 'use-undoable'
import { v4 as uuidv4 } from 'uuid'

import { useAuth } from './auth'
import FunctionNode, { FunctionNodeProperties } from '../components/GraphViewer/FunctionNode'
import InputEdge, { InputEdgeProperties } from '../components/GraphViewer/InputEdge'
import MetricNode, { MetricNodeProperties } from '../components/GraphViewer/MetricNode'
import { supabase } from '../utils/supabaseClient'

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

type GraphContextType = {
  initialGraph: Graph,
  graph: Graph,
  undo: (() => void) | undefined,
  redo: (() => void) | undefined,
  canUndo: boolean,
  canRedo: boolean,
  loadGraph: (() => Promise<void>) | undefined,
  saveGraph: (() => Promise<Response | undefined>) | undefined,
  updateGraph: ((t: 'all' | 'nodes' | 'edges', v: Array<any>, undoable: boolean) => void) | undefined,
  setNodeDataToChange: Dispatch<SetStateAction<MetricNodeProperties | FunctionNodeProperties | undefined>> | undefined,
  formMetricNode: (() => Node<any>) | undefined,
  formFunctionNode: ((newNodeId: string, functionTypeId: string, inputNodes: Node[], outputNode: Node) => Node<any>) | undefined,
  formInputEdge: ((source: Node, target: Node, displaySource?: Node | undefined, displayTarget?: Node | undefined) => Edge<any>) | undefined,
  getConnectedFunctionNodesAndInputEdges: ((reference: Node | Edge, calledFrom?: string) => (Node<any> | Edge<any>)[]) | undefined,
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
  getConnectedFunctionNodesAndInputEdges: undefined,
}

const GraphContext = createContext<GraphContextType>(
  graphContextDefaultValues
)

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

  const [nodeTypeIds, setNodeTypeIds] = useState<TypeIdMap>(
    Object.fromEntries(Object.keys(nodeTypes).map((key) => [key, '']))
  )
  async function getNodeTypeIds() {
    try {
      let { data, error, status } = await supabase
        .from('node_types')
        .select('name, id')

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
    try {
      // TODO: loading animation
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
  }, [organizationId, reset])
  
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
    // TODO: set dynamically; challenge is can't use useReactFlow here
    const x = 0;
    const y = 0;
    const newNodeId = uuidv4()
    const newNodeData: MetricNodeProperties = {
      id: newNodeId, // needed for setNodeDataToChange
      organizationId: organizationId,
      typeId: newNodeTypeId,
      name: 'New Metric',
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
  }, [nodeTypeIds, organizationId, setNodeDataToChange])

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

  const getConnectedFunctionNodesAndInputEdges = useCallback(
    (reference: Node | Edge, calledFrom: string = '') => {
      let connectedFunctionNodesAndInputEdges: (Node | Edge)[] = []
      if (reference.type === 'function') {
        // select connected edges
        graph.edges.forEach((edge) => {
          if (
            (edge.data.sourceId === reference.id ||
              edge.data.targetId === reference.id) &&
            edge.type === 'input' &&
            edge.id !== calledFrom
          ) {
            connectedFunctionNodesAndInputEdges =
              connectedFunctionNodesAndInputEdges.concat(
                [edge],
                getConnectedFunctionNodesAndInputEdges(edge, reference.id)
              )
          }
        })
      } else if (reference.type === 'input') {
        // select connected function nodes
        graph.nodes.forEach((node) => {
          if (
            (node.id === reference.data.sourceId ||
              node.id === reference.data.targetId) &&
            node.type === 'function' &&
            node.id !== calledFrom
          ) {
            connectedFunctionNodesAndInputEdges =
              connectedFunctionNodesAndInputEdges.concat(
                [node],
                getConnectedFunctionNodesAndInputEdges(node, reference.id)
              )
          }
        })
      }
      return connectedFunctionNodesAndInputEdges
    },
    [graph]
  )

  const value = {
    initialGraph: initialGraph,
    graph: graph,
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
    getConnectedFunctionNodesAndInputEdges: getConnectedFunctionNodesAndInputEdges,
  }
  return (
    <>
      <GraphContext.Provider value={value}>
        {children}
      </GraphContext.Provider>
    </>
  )
}