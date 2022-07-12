import { useRouter } from 'next/router'
import { Button } from 'primereact/button'
import { Toolbar } from 'primereact/toolbar'
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
  useReactFlow
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
  const { project } = useReactFlow()

  const loadFlow = useCallback(() => {
    const flowStr = localStorage.getItem(flowKey) || ''
    if (flowStr) {
      const flow = JSON.parse(flowStr)
      setNodes(flow.nodes || [])
      setEdges(flow.edges || [])
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

  const onAdd = useCallback(() => {
    const { x, y } = project({ x: self.innerWidth/4, y: self.innerHeight-250 })
    const newNode = {
      id: `randomnode_${+new Date()}`,
      data: { label: 'Added node' },
      position: {
        x: x,
        y: y
      },
    }
    setNodes((nds) => nds.concat(newNode))
  }, [project, setNodes])
  
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const ControlPanel: FunctionComponent = () => {
    if (editingEnabled) {
      return null
    } else {
      return (
        <div className={styles.control_panel}>
          <Button
            icon="pi pi-calendar"
            disabled={true} // TODO: activate
          />
          <Button
            icon="pi pi-history"
            disabled={true} // TODO: activate
          />
          <Button
            icon="pi pi-pencil"
            disabled={!userCanEdit}
            onClick={() => setEditingEnabled(true)}
          />
        </div>
      )
    }
  }

  const EditorDock: FunctionComponent = () => {
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
        <div className={styles.editor_dock}>
          <Toolbar className={styles.editor_toolbar}
            left = {
              <div>
                <Button
                  icon='pi pi-plus'
                  onClick={onAdd}
                />
              </div>
            }
            right = {
              <div>
                <Button
                  className='p-button-outlined'
                  icon='pi pi-undo'
                  disabled={true} // TODO: activate
                />
                <Button
                  className='p-button-outlined'
                  icon='pi pi-refresh'
                  disabled={true} // TODO: activate
                />
                <Button
                  label='Save'
                  onClick={() => saveEditing()}
                />
                <Button
                  className='p-button-outlined'
                  label='Cancel'
                  onClick={() => cancelEditing()}
                />
              </div>
            }
          />
        </div>
      )
    } else {
      return null
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
        <ControlPanel />
        <Controls showInteractive={false} />
        <EditorDock />
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
