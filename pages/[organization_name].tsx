import { useRouter } from 'next/router'
import React, { FunctionComponent, useCallback, useState } from 'react'
import ReactFlow, {
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowInstance,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'react-flow-renderer'

import Account from '../components/Account'
import styles from '../styles/Workspace.module.css'

const flowKey = 'example-flow'
const initialNodes: Node[] = [
  { id: '1', data: { label: 'Node 1' }, position: { x: 100, y: 100 } },
  { id: '2', data: { label: 'Node 2' }, position: { x: 100, y: 200 } },
]
const initialEdges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }]

type MGraphProps = {}
const MGraph: FunctionComponent<MGraphProps> = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance>()
  const { setViewport } = useReactFlow()

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const onSave = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject()
      localStorage.setItem(flowKey, JSON.stringify(flow))
    }
  }, [rfInstance])

  const onRestore = useCallback(() => {
    const restoreFlow = async () => {
      const flow = JSON.parse(localStorage.getItem(flowKey) || '')
      if (flow) {
        setNodes(flow.nodes || [])
        setEdges(flow.edges || [])
        const { x, y, zoom } = flow.viewport
        setViewport({ x, y, zoom })
      }
    }

    restoreFlow()
  }, [setNodes, setEdges, setViewport])

  const onAdd = useCallback(() => {
    const newNode = {
      id: `randomnode_${+new Date()}`,
      data: { label: 'Added node' },
      position: {
        x: Math.random() * window.innerWidth - 100,
        y: Math.random() * window.innerHeight,
      },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [setNodes])

  return (
    <div className={styles.mgraph}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
      >
        <div className={styles.save_controls}>
          <button onClick={onSave}>save</button>
          <button onClick={onRestore}>restore</button>
          <button onClick={onAdd}>add node</button>
        </div>
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

type WorkspaceProps = {}
const Workspace: FunctionComponent<WorkspaceProps> = () => {
  const router = useRouter()
  const { organization_name } = router.query

  return (
    <div className={styles.workspace}>
      <div className={styles.header}>
        <div className={styles.mgraph_logo_container}>
          <h1>MGraph</h1>
        </div>
        <div className={styles.user_info_container}>
          <div className={styles.user_organization_logo_container}>
            {organization_name}
          </div>
          <p>&nbsp;&nbsp;&nbsp;</p>
          <div className={styles.user_account_container}>
            <Account />
          </div>
        </div>
      </div>
      <div className={styles.mgraph_container}>
        <ReactFlowProvider>
          <MGraph />
        </ReactFlowProvider>
      </div>
    </div>
  )
}

export default Workspace
