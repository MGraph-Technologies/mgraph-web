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
import { v4 as uuidv4 } from 'uuid'

import ControlPanel from './ControlPanel'
import EditorDock from './EditorDock/EditorDock'
import FunctionalEdge, { FunctionalEdgeProperties } from './FunctionalEdge'
import MetricNode, { MetricNodeProperties } from './MetricNode'
import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import styles from '../../styles/GraphViewer.module.css'
import { supabase } from '../../utils/supabaseClient'

export type Graph = {
  nodes: Node[]
  edges: Edge[]
}
const nodeTypes = {
  metric: MetricNode,
}
const edgeTypes = {
  input: FunctionalEdge,
  positive_input: FunctionalEdge,
  negative_input: FunctionalEdge,
}

type GraphViewerProps = {
  organizationId: string
}
const GraphViewer: FunctionComponent<GraphViewerProps> = ({
  organizationId,
}) => {
  const { session } = useAuth()
  const { editingEnabled, disableEditing } = useEditability()

  type TypeIdMap = { [key: string]: string }
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

  const [initialGraph, setInitialGraph] = useState<Graph>({
    nodes: [],
    edges: [],
  })
  const [graph, setGraph, { undo, redo, canUndo, canRedo, reset }] =
    useUndoable<Graph>(initialGraph, {
      behavior: 'destroyFuture',
      ignoreIdenticalMutations: false,
    })
  const { project } = useReactFlow()

  const actionKey = navigator.platform.match(/Mac/i) ? 'Meta' : 'Control'
  const [actionKeyPressed, setActionKeyPressed] = useState(false)
  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(true)
      }

      if (actionKeyPressed && !e.shiftKey && e.key === 'z') {
        undo()
      }
      if (actionKeyPressed && e.shiftKey && e.key === 'z') {
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
  const [nodeDataToChange, setNodeDatatoChange] =
    useState<MetricNodeProperties>()
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
      setNodeDatatoChange(undefined) // avoid infinite loop
    }
  }, [nodeDataToChange, setNodeDatatoChange, updateGraph, graph.nodes])

  const onNodeDragStart = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
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
      updateGraph('edges', applyEdgeChanges(changes, graph.edges), true)
    },
    [updateGraph, graph.edges]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdgeType = 'input'
      const newEdgeTypeId = edgeTypeIds[newEdgeType]
      if (newEdgeTypeId) {
        const newEdgeId = uuidv4()
        const newEdgeData: FunctionalEdgeProperties = {
          id: newEdgeId,
          organizationId: organizationId,
          typeId: newEdgeTypeId,
          sourceId: connection.source || '', // it'll never not be set, but typescript doesn't know that
          targetId: connection.target || '',
          initialProperties: {},
        }
        const newEdge = {
          ...connection,
          type: newEdgeType,
          id: newEdgeId,
          data: newEdgeData,
          animated: true,
        }
        updateGraph('edges', addEdge(newEdge, graph.edges), true)
      }
    },
    [edgeTypeIds, organizationId, updateGraph, graph.edges]
  )

  const onMetricNodeAddition = useCallback(() => {
    const newNodeType = 'metric'
    const newNodeTypeId = nodeTypeIds[newNodeType]
    if (newNodeTypeId) {
      const { x, y } = project({
        x: self.innerWidth / 4,
        y: self.innerHeight - 250,
      })
      const newNodeId = uuidv4()
      const newNodeData: MetricNodeProperties = {
        id: newNodeId, // needed for setNodeDataToChange
        organizationId: organizationId,
        typeId: newNodeTypeId,
        name: 'New Metric',
        color: '#FFFFFF',
        initialProperties: {},
        setNodeDatatoChange: setNodeDatatoChange,
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
      updateGraph('nodes', graph.nodes.concat(newNode), true)
    }
  }, [
    nodeTypeIds,
    project,
    organizationId,
    setNodeDatatoChange,
    updateGraph,
    graph.nodes,
  ])

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
          parsedNode.data = {
            // explicit construction so properties added outside of react flow don't break it
            id: parsedProperties.id,
            organizationId: parsedProperties.organizationId,
            typeId: parsedProperties.typeId,
            name: parsedProperties.name,
            color: parsedProperties.color,
            initialProperties: parsedProperties,
            setNodeDatatoChange: setNodeDatatoChange,
          } as MetricNodeProperties
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
          } as FunctionalEdgeProperties
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
  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const saveGraph = useCallback(async () => {
    const accessToken = session?.access_token
    if (!accessToken) {
      return
    }
    // remove selections
    graph.nodes = graph.nodes.map((n) => ({ ...n, selected: false }))
    graph.edges = graph.edges.map((e) => ({ ...e, selected: false }))

    await fetch('/api/v1/graphs', {
      method: 'PUT',
      body: JSON.stringify({
        initialGraph: initialGraph,
        updatedGraph: graph,
      }),
      headers: {
        'supabase-access-token': accessToken,
      },
    })
      .then((response) => {
        if (response.status === 200) {
          // only reset if the save was successful
          disableEditing()
          loadGraph()
        } else {
          console.error(response)
        }
      })
      .catch((error) => {
        console.error('Error:', error)
      })
  }, [session, graph, initialGraph, disableEditing, loadGraph])

  const cancelEditing = useCallback(() => {
    loadGraph()
    disableEditing()
  }, [])
  return (
    <div className={styles.graph_viewer}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        multiSelectionKeyCode={[actionKey]}
      >
        <ControlPanel />
        <Controls showInteractive={false} />
        <EditorDock 
          editingEnabled={editingEnabled}
          graph={graph}
          onCancel={cancelEditing}
          onSave={saveGraph}
          onMetricAddition={onMetricNodeAddition}
        />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default GraphViewer
