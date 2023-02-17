/* sourced from here: 
https://github.com/supabase/supabase/discussions/6177 */
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

let supabase: SupabaseClient
const sessions: { [key: string]: Session | null } = {}

export async function getSession({
  email,
  password,
  supabaseUrl,
  supabaseAnonKey,
}: {
  email: string
  password: string
  supabaseUrl: string
  supabaseAnonKey: string
}) {
  // If there's already a supabase client, use it, don't create a new one.
  if (!supabase) {
    supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
  }

  // Create a session for the user if it doesn't exist already.
  // You can then log in as any number of test users from your tests.
  if (!sessions[email]) {
    const { data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    sessions[email] = data.session
  }

  return sessions[email]
}

export async function insertCustomNode({
  accessToken,
  nodeName,
}: {
  accessToken: string
  nodeName: string
}) {
  // create supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )

  // get user id and org id
  const editorEmail =
    process.env.NEXT_PUBLIC_CYPRESS_TEST_ACCOUNT_EMAIL?.replace(
      '@mgraph.us',
      '+editor@mgraph.us'
    )
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, organization_members ( organization_id )')
    .eq('email', editorEmail)
    .single()
  if (userError) {
    throw new Error(userError.message)
  }
  const user = userData as {
    id: string
    organization_members: { organization_id: string }[]
  }
  const userId = user.id
  const orgId = user.organization_members[0].organization_id

  // get node type id
  const { data: nodeTypeData, error: nodeTypeError } = await supabase
    .from('node_types')
    .select('id')
    .eq('name', 'custom')
    .single()
  if (nodeTypeError) {
    throw new Error(nodeTypeError.message)
  }
  const nodeType = nodeTypeData as { id: string }
  const nodeTypeId = nodeType.id

  // insert node
  const nodeId = uuidv4()
  const { error: nodeError } = await supabase.from('nodes').insert([
    {
      id: nodeId,
      organization_id: orgId,
      type_id: nodeTypeId,
      properties: {
        id: nodeId,
        organizationId: orgId,
        typeId: nodeTypeId,
        name: nodeName,
        description: '',
        owner: '',
        source: {
          html: '',
          css: '',
        },
        color: '#FFFFFF',
      },
      react_flow_meta: {
        id: nodeId,
        type: 'custom',
        position: {
          x: 640,
          y: 368,
        },
        height: 288,
        width: 512,
        selected: false,
        dragging: false,
      },
      created_at: new Date(),
      created_by: userId,
      updated_at: new Date(),
      updated_by: userId,
      deleted_at: null,
      deleted_by: null,
    },
  ])
  if (nodeError) {
    throw new Error(nodeError.message)
  }
  return nodeId
}
