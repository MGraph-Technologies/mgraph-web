import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'

import { decryptCredentials, makeToken } from '../../../utils/snowflakeCrypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/database-queries...')
  const method = req.method
  if (method === 'POST') {
    const body = JSON.parse(req.body)
    console.log('\nBody: ', body)
    const { databaseConnectionId, parentNodeId, statement } = body

    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    supabase.auth.setAuth(accessToken)
    try {
      const { data, error, status } = await supabase
        .from('database_connections')
        .select(
          'encrypted_credentials, organizations (id, created_at), database_connection_types (name)'
        )
        .eq('id', databaseConnectionId)
        .is('deleted_at', null)
        .single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        if (!(data.database_connection_types.name === 'snowflake')) {
          throw new Error(
            'We only support snowflake database connections at this time.'
          )
        }
        const {
          region,
          account,
          username,
          privateKeyString,
          privateKeyPassphrase,
        } = decryptCredentials(
          data.encrypted_credentials,
          data.organizations.id,
          data.organizations.created_at
        )
        const token = makeToken(
          account,
          username,
          privateKeyString,
          privateKeyPassphrase
        )

        const resp = await fetch(
          'https://' +
            account +
            '.' +
            region +
            '.snowflakecomputing.com/api/v2/statements?async=true',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
              'User-Agent': 'MGraph/1.0',
              'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
            },
            body: JSON.stringify({
              statement: statement,
            }),
          }
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const respBody = (await resp.json()) as any

        const queryId = uuidv4()
        const { error } = await supabase.from('database_queries').insert({
          id: queryId,
          database_connection_id: databaseConnectionId,
          parent_node_id: parentNodeId,
          statement: statement,
          result_url:
            'https://' +
            account +
            '.' +
            region +
            '.snowflakecomputing.com' +
            respBody.statementStatusUrl,
        })
        if (error) {
          throw error
        }
        console.log('\nQuery ID: ', queryId)
        return res.status(200).json({
          queryId: queryId,
        })
      } else {
        const errorMessage = 'Database connection not found'
        console.error('\nError: ', errorMessage)
        return res.status(404).json({
          error: errorMessage,
        })
      }
    } catch (error: unknown) {
      console.error('\nError: ', error)
      return res.status(500).json({
        error: error,
      })
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }
}

export default withSentry(handler)
