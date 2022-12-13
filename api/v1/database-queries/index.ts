import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import { v4 as uuidv4 } from 'uuid'

import { SENTRY_CONFIG } from '../../../sentry.server.config.js'
import { getBaseUrl } from '../../../utils/appBaseUrl'
import { decryptCredentials, formJdbcUrl } from '../../../utils/snowflakeCrypto'

Sentry.init(SENTRY_CONFIG)

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
        const decryptedCredentials = decryptCredentials(
          data.encrypted_credentials,
          data.organizations.id,
          data.organizations.created_at
        )
        const { region, account, username, password } = decryptedCredentials
        const resp = await fetch(
          getBaseUrl() + `/api/v1/database-queries/snowflake-jdbc-proxy`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Snowflake-JDBC-URL': formJdbcUrl(decryptedCredentials),
              'Snowflake-Username': username,
              'Snowflake-Password': password,
            },
            body: JSON.stringify({
              statement: statement,
            }),
          }
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const respBody = (await resp.json()) as any
        const snowflakeQueryId = respBody.snowflakeQueryId

        const databaseQueryId = uuidv4()
        console.log('\nQuery ID: ', databaseQueryId)

        const { error } = await supabase.from('database_queries').insert({
          id: databaseQueryId,
          database_connection_id: databaseConnectionId,
          parent_node_id: parentNodeId,
          statement: statement,
          result_url:
            'https://' +
            account +
            '.' +
            region +
            '.snowflakecomputing.com' +
            '/api/v2/statements/' +
            snowflakeQueryId,
        })
        if (error) {
          throw error
        }
        return res.status(200).json({
          queryId: databaseQueryId,
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

export default Sentry.withSentryAPI(handler, '/api/v1/database-queries')
