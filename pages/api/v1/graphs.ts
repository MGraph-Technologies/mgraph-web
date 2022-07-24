import _ from 'lodash'
import { NextApiRequest, NextApiResponse } from 'next'
import { Edge, Node } from 'react-flow-renderer'
import {
  createClient,
  PostgrestError,
  PostgrestResponse,
  SupabaseClient,
} from '@supabase/supabase-js'
import { type } from 'cypress/types/jquery'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function upsert(
  objects: Edge[] | Node[],
  op: 'create' | 'delete' | 'update',
  supabase: SupabaseClient,
  accessToken: string
): Promise<PostgrestResponse<any>> {
  const { user, error } = await supabase.auth.api.getUser(accessToken)
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
    react_flow_meta: string
    updated_at: Date
    updated_by: string
    name?: string // only nodes have names
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
    const { id, data } = object
    let record: Record = {
      id: id,
      organization_id: data.organizationId,
      type_id: data.typeId,
      react_flow_meta: JSON.stringify(object),
      updated_at: currentDate,
      updated_by: userId,
    }
    if (recordType === 'node') {
      record = {
        ...record,
        name: data.name,
      }
    } else if (recordType === 'edge') {
      record = {
        ...record,
        // @ts-ignore object is definitely an edge
        source_id: object.source,
        // @ts-ignore
        target_id: object.target,
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
    '\n\nop:',
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const method = req.method
  if (method === 'PUT') {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    supabase.auth.setAuth(accessToken)

    const body = JSON.parse(req.body)
    const { initialGraph, updatedGraph } = body

    let upsertErrors: PostgrestError[] = []

    // upsert nodes
    const initialNodes: Node[] = initialGraph.nodes
    const updatedNodes: Node[] = updatedGraph.nodes

    const addedNodes = updatedNodes.filter(
      (updatedNode) =>
        !initialNodes.some((initialNode) => initialNode.id === updatedNode.id)
    )
    if (addedNodes.length > 0) {
      const { error: addedNodesError } = await upsert(
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
      const { error: modifiedNodesError } = await upsert(
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
      const { error: deletedNodesError } = await upsert(
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
        !initialEdges.some((initialEdge) => initialEdge.id === updatedEdge.id)
    )
    if (addedEdges.length > 0) {
      const { error: addedEdgesError } = await upsert(
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
      const { error: modifiedEdgesError } = await upsert(
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
      const { error: deletedEdgesError } = await upsert(
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
      res.status(200).json({ success: true })
    }
  } else {
    console.log('\n\nUnsupported method: ', method)
    res.status(405).json({ success: false, message: 'Method not allowed' })
  }
}
