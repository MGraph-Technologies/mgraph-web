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
  EdgeChange,
  MiniMap,
  Node,
  NodeChange,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow
} from 'react-flow-renderer'
import useUndoable from 'use-undoable'

import Account from '../components/Account'
import styles from '../styles/Workspace.module.css'

const flowKey = 'example-flow'
const userCanEdit = true // TODO: get this from db

type MGraphProps = {}
const MGraph: FunctionComponent<MGraphProps> = () => {
  const initialNodes: Node[] = []
  const initialEdges: Edge[] = []
  const [elements, setElements, { resetInitialState, undo, redo, canUndo, canRedo }] = useUndoable({
		nodes: initialNodes,
    edges: initialEdges
	})
  const [editingEnabled, setEditingEnabled] = useState(false)
  const { project } = useReactFlow()

  const updateElements = useCallback(
		(t: 'nodes' | 'edges' | 'all', v: Array<any>) => {
			// To prevent a mismatch of state updates,
			// we'll use the value passed into this
			// function instead of the state directly.
      if (t === 'all') {
        setElements(v[0]) // kinda hacky but oh well
      } else {
        setElements(e => ({
          nodes: t === 'nodes' ? v : e.nodes,
          edges: t === 'edges' ? v : e.edges,
        }))
      }
		},
		[setElements]
	)

  const loadFlow = useCallback(() => {
    const flowStr = localStorage.getItem(flowKey) || ''
    if (flowStr) {
      const flow = JSON.parse(flowStr)
      updateElements('all', [flow])
      resetInitialState({nodes: flow.nodes, edges: flow.edges})
    }
  }, [])

  useEffect(() => {
    loadFlow()
  }, [])

  const saveFlow = useCallback(() => {
    localStorage.setItem(flowKey, JSON.stringify(elements))
  }, [elements])

  const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			updateElements('nodes', applyNodeChanges(changes, elements.nodes))
		},
		[updateElements, elements.nodes]
	)

	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => {
			updateElements('edges', applyEdgeChanges(changes, elements.edges))
		},
		[updateElements, elements.edges]
	)

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
    updateElements('nodes', elements.nodes.concat(newNode))
  }, [project, updateElements, elements.nodes])
  
  const onConnect = useCallback(
		(connection: Connection) => {
			updateElements('edges', addEdge(connection, elements.edges));
		},
		[updateElements, elements.edges]
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
                  onClick={undo}
                  disabled={!canUndo}
                />
                <Button
                  className='p-button-outlined'
                  icon='pi pi-refresh'
                  onClick={redo}
                  disabled={!canRedo}
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
        nodes={elements.nodes}
        edges={elements.edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
