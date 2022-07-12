import { useRouter } from 'next/router'
import { Button } from 'primereact/button'
import React, { 
  FunctionComponent,
  useCallback,
  useEffect,
  useState
} from 'react'
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
const userCanEdit = true // TODO: get this from db

type MGraphProps = {}
const MGraph: FunctionComponent<MGraphProps> = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [editingEnabled, setEditingEnabled] = useState(false)
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance>()
  const { setViewport } = useReactFlow()

  const loadFlow = useCallback(() => {
    const flowStr = localStorage.getItem(flowKey) || ''
    if (flowStr) {
      const flow = JSON.parse(flowStr)
      setNodes(flow.nodes || [])
      setEdges(flow.edges || [])
      const { x, y, zoom } = flow.viewport
      setViewport({ x, y, zoom })
    }
  }, [])

  useEffect(() => {
    loadFlow()
  }, [])

  const saveFlow = useCallback(() => {
    if (rfInstance) {
      const flow = rfInstance.toObject()
      localStorage.setItem(flowKey, JSON.stringify(flow))
    }
  }, [rfInstance])
  
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const ControlPanel: FunctionComponent = () => {
    const saveEditing = useCallback(() => {
      saveFlow()
      setEditingEnabled(false)
    }, [])

    const cancelEditing = useCallback(() => {
      loadFlow()
      setEditingEnabled(false)
    }, [])

    if (editingEnabled) {
      return (
        <div>
          <Button
            className='button p-button-secondary p-button-raised'
            label='Save'
            onClick={() => saveEditing()}
          />
          <Button
            className='button p-button-secondary p-button-raised p-button-outlined'
            label='Cancel'
            onClick={() => cancelEditing()}
          />
        </div>
      )
    } else {
      return (
        <div>
          <Button
            className='button p-button-secondary p-button-raised'
            icon="pi pi-pencil"
            disabled={!userCanEdit}
            onClick={() => setEditingEnabled(true)}
          />
        </div>
      )
    }
  }

  return (
    <div className={styles.mgraph}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        elementsSelectable={editingEnabled}
        nodesDraggable={editingEnabled}
        nodesConnectable={editingEnabled}
        panOnScroll={true}
      >
        <div className={styles.control_panel}>
          <ControlPanel />
        </div>
        <Controls showInteractive={false} />
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
