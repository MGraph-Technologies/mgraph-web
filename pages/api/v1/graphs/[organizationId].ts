import { withSentry } from '@sentry/nextjs'
import {
  createClient,
  PostgrestError,
  PostgrestResponse,
  SupabaseClient,
} from '@supabase/supabase-js'
import _ from 'lodash'
import { NextApiRequest, NextApiResponse } from 'next'
import { Edge, Node } from 'react-flow-renderer'

import { FunctionNodeProperties } from '../../../../components/graph/FunctionNode'
import { InputEdgeProperties } from '../../../../components/graph/InputEdge'
import { MetricNodeProperties } from '../../../../components/graph/MetricNode'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/graphs/[organizationId]...')
  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const accessToken = (req.headers['supabase-access-token'] as string) || ''
  supabase.auth.setAuth(accessToken)

  const { organizationId } = req.query
  console.log('organizationId: ', organizationId)

  const method = req.method
  if (method === 'GET') {
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
        const nodes = nodesData.map((n) => {
          let node = n.react_flow_meta
          const properties = n.properties
          if (node.type === 'metric') {
            node.data = {
              // explicit construction so properties added outside of react flow don't break it
              id: properties.id,
              organizationId: properties.organizationId,
              typeId: properties.typeId,
              name: properties.name,
              description: properties.description,
              owner: properties.owner,
              sourceCode: properties.sourceCode,
              sourceDatabaseConnectionId: properties.sourceDatabaseConnectionId,
              color: properties.color,
              initialProperties: properties,
              setNodeDataToChange: () => {},
            } as MetricNodeProperties
          }
          if (node.type === 'function') {
            node.data = {
              id: properties.id,
              organizationId: properties.organizationId,
              typeId: properties.typeId,
              functionTypeId: properties.functionTypeId,
              color: properties.color,
              initialProperties: properties,
              setNodeDataToChange: () => {},
            } as FunctionNodeProperties
          }
          return node
        })
        const edges = edgesData.map((e) => {
          let edge = e.react_flow_meta
          const properties = e.properties
          edge.data = {
            id: properties.id,
            organizationId: properties.organizationId,
            typeId: properties.typeId,
            sourceId: properties.sourceId,
            targetId: properties.targetId,
            initialProperties: properties,
          } as InputEdgeProperties
          return edge
        })
        const graph = {
          nodes: nodes,
          edges: edges,
        }
        return res.status(200).json({
          graph: graph,
        })
      }
    } catch (error: any) {
      console.log('\nError: ', error.message)
      return res.status(500).json({
        error: error.message,
      })
    }
  } else if (method === 'PUT') {
    const body = JSON.parse(req.body)
    console.log('\nBody: ', body)
    const { initialGraph, updatedGraph } = body

    let upsertErrors: PostgrestError[] = []

    // upsert nodes
    const initialNodes: Node[] = initialGraph.nodes
    const updatedNodes: Node[] = updatedGraph.nodes

    const addedNodes = updatedNodes.filter(
      (updatedNode) =>
        !initialNodes.find((initialNode) => initialNode.id === updatedNode.id)
    )
    if (addedNodes.length > 0) {
      let { error: addedNodesError } = await upsert(
        addedNodes,
        'create',
        supabase,
        accessToken
      )
      if (addedNodesError) {
        upsertErrors.push(addedNodesError)
      }
    }

    const modifiedNodes = updatedNodes.filter((updatedNode) => {
      const initialNode = initialNodes.find(
        (initialNode) => initialNode.id === updatedNode.id
      )
      return initialNode && !_.isEqual(initialNode, updatedNode)
    })
    if (modifiedNodes.length > 0) {
      let { error: modifiedNodesError } = await upsert(
        modifiedNodes,
        'update',
        supabase,
        accessToken
      )
      if (modifiedNodesError) {
        upsertErrors.push(modifiedNodesError)
      }
    }

    const deletedNodes = initialNodes.filter(
      (initialNode) =>
        !updatedNodes.find((updatedNode) => updatedNode.id === initialNode.id)
    )
    if (deletedNodes.length > 0) {
      let { error: deletedNodesError } = await upsert(
        deletedNodes,
        'delete',
        supabase,
        accessToken
      )
      if (deletedNodesError) {
        upsertErrors.push(deletedNodesError)
      }
    }

    // upsert edges
    const initialEdges: Edge[] = initialGraph.edges
    const updatedEdges: Edge[] = updatedGraph.edges

    const addedEdges = updatedEdges.filter(
      (updatedEdge) =>
        !initialEdges.find((initialEdge) => initialEdge.id === updatedEdge.id)
    )
    if (addedEdges.length > 0) {
      let { error: addedEdgesError } = await upsert(
        addedEdges,
        'create',
        supabase,
        accessToken
      )
      if (addedEdgesError) {
        upsertErrors.push(addedEdgesError)
      }
    }

    const modifiedEdges = updatedEdges.filter((updatedEdge) => {
      const initialEdge = initialEdges.find(
        (initialEdge) => initialEdge.id === updatedEdge.id
      )
      return initialEdge && !_.isEqual(initialEdge, updatedEdge)
    })
    if (modifiedEdges.length > 0) {
      let { error: modifiedEdgesError } = await upsert(
        modifiedEdges,
        'update',
        supabase,
        accessToken
      )
      if (modifiedEdgesError) {
        upsertErrors.push(modifiedEdgesError)
      }
    }

    const deletedEdges = initialEdges.filter(
      (initialEdge) =>
        !updatedEdges.find(
          (updatedEdge) => updatedEdge.id === initialEdge.id
        ) ||
        deletedNodes.find(
          (deletedNode) => deletedNode.id === initialEdge.source
        ) ||
        deletedNodes.find(
          (deletedNode) => deletedNode.id === initialEdge.target
        )
    )
    if (deletedEdges.length > 0) {
      let { error: deletedEdgesError } = await upsert(
        deletedEdges,
        'delete',
        supabase,
        accessToken
      )
      if (deletedEdgesError) {
        upsertErrors.push(deletedEdgesError)
      }
    }

    if (upsertErrors.length > 0) {
      console.log('\nErrors: ', upsertErrors)
      res
        .status(500)
        .json({ success: false, message: 'Failed to upsert nodes' })
    } else {
      console.log('\nSuccess!')
      return res.status(200).json({})
    }
  } else {
    console.log('\nUnsupported method: ', method)
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

async function upsert(
  objects: Edge[] | Node[],
  op: 'create' | 'delete' | 'update',
  supabase: SupabaseClient,
  accessToken: string
): Promise<PostgrestResponse<any>> {
  let { user, error } = await supabase.auth.api.getUser(accessToken)
  if (error) {
    throw error
  } else if (!user) {
    throw new Error('User not found')
  }
  const userId = user.id

  type Record = {
    id: string
    organization_id: string
    type_id: string
    properties: object
    react_flow_meta: object
    updated_at: Date
    updated_by: string
    source_id?: string // only edges have source_id
    target_id?: string // only edges have target_id
    created_at?: Date // only needed for create
    created_by?: string // only needed for create
    deleted_at?: Date // only needed for delete
    deleted_by?: string // only needed for delete
  }
  const recordType =
    'source' in objects[0] && 'target' in objects[0] ? 'edge' : 'node'
  const currentDate = new Date()
  const records: Record[] = objects.map((object) => {
    const { data, ...reactFlowMeta } = object
    const { initialProperties, ...updatedProperties } = data
    let record: Record = {
      id: updatedProperties.id,
      organization_id: updatedProperties.organizationId,
      type_id: updatedProperties.typeId,
      properties: {
        // so properties created outside of React Flow are not overwritten
        ...initialProperties,
        ...updatedProperties,
      },
      react_flow_meta: reactFlowMeta,
      updated_at: currentDate,
      updated_by: userId,
    }
    if (recordType === 'edge') {
      record = {
        ...record,
        // @ts-ignore object is definitely an edge
        source_id: updatedProperties.sourceId,
        // @ts-ignore
        target_id: updatedProperties.targetId,
      }
    }
    if (op === 'create') {
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

  console.log(
    '\nop:',
    op,
    '\nrecord type: ',
    recordType,
    '\nrecords: ',
    records
  )
  return supabase
    .from(`${recordType}s`)
    .upsert(records, { returning: 'minimal' })
}

export default withSentry(handler)
