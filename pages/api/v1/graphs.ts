import _ from 'lodash'
import { NextApiRequest, NextApiResponse } from 'next'
import { Node } from 'react-flow-renderer'
import { createClient, PostgrestResponse, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function upsertNodes(
  nodes: Node[], 
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

  type UpsertRecord = {
    id: string,
    organization_id: string,
    type_id: string,
    name: string,
    react_flow_meta: string,
    created_at?: Date,
    created_by?: string,
    updated_at: Date,
    updated_by: string,
    deleted_at?: Date,
    deleted_by?: string
  }
  const currentDate = new Date()
  const toUpsert: UpsertRecord[] = nodes.map(node => {
    const { id, data } = node
    let upsertRecord: UpsertRecord = {
      id: id,
      organization_id: data.organizationId,
      type_id: data.typeId,
      name: data.name,
      react_flow_meta: JSON.stringify(node),
      updated_at: currentDate,
      updated_by: userId,
    }
    if (op === 'create') {
      upsertRecord = {
        ...upsertRecord,
        created_at: currentDate,
        created_by: userId,
      }
    }
    if (op === 'delete') {
      upsertRecord = {
        ...upsertRecord,
        deleted_at: currentDate,
        deleted_by: userId,
      }
    }
    return upsertRecord
  })
  console.log('\n\nop:', op, '\nnodes: ', toUpsert)
  return supabase
      .from('nodes')
      .upsert(toUpsert, { returning: 'minimal' })
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const method = req.method
  if (method === 'PUT') {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const accessToken = req.headers['supabase-access-token'] as string || ''
    supabase.auth.setAuth(accessToken)
    
    const body = JSON.parse(req.body)
    const { initialGraph, updatedGraph } = body

    // upsert nodes
    const initialNodes: Node[] = initialGraph.nodes
    const updatedNodes: Node[] = updatedGraph.nodes

    const addedNodes = updatedNodes.filter(
      (updatedNode) => !(
        initialNodes.some((initialNode) => initialNode.id === updatedNode.id)
      )
    )
    const { error: additionNodesError } = await upsertNodes(addedNodes, 'create', supabase, accessToken)

    const modifiedNodes = updatedNodes.filter((updatedNode) => {
      const initialNode = (
        initialNodes.find((initialNode) => initialNode.id === updatedNode.id)
      )
      return (initialNode && !_.isEqual(initialNode, updatedNode))
    })
    const { error: updateNodesError } = await upsertNodes(modifiedNodes, 'update', supabase, accessToken)

    const deletedNodes = initialNodes.filter(
      (initialNode) => !(
        updatedNodes.find((updatedNode) => updatedNode.id === initialNode.id)
      )
    )
    const { error: deletionNodesError } = await upsertNodes(deletedNodes, 'delete', supabase, accessToken)

    // upsert edges
    // tba

    if (additionNodesError || updateNodesError || deletionNodesError) {
      console.log('\nErrors: ', additionNodesError, updateNodesError, deletionNodesError)
      res.status(500).json({ success: false, message: 'Failed to upsert nodes' })
    } else {
      console.log('\nSuccess!')
      res.status(200).json({ success: true })
    }
  } else {
    console.log('\n\nUnsupported method: ', method)
    res.status(405).json({ success: false, message: 'Method not allowed' })
  }
}