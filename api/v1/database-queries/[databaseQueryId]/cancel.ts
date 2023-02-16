import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'
import { getBaseUrl } from '../../../../utils/appBaseUrl'
import {
  decryptCredentials,
  formJdbcUrl,
} from '../../../../utils/snowflakeCrypto'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/database-queries/[databaseQueryId]/cancel...'
  )
  const method = req.method
  if (method === 'POST') {
    console.log('\nQuery: ', req.query)
    const { databaseQueryId } = req.query

    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
    try {
      const { data, error, status } = await supabase
        .from('database_queries')
        .select(
          `
          result_url,
          database_connections (
            encrypted_credentials,
            organizations (id, created_at))'
          )
        `
        )
        .eq('id', databaseQueryId)
        .is('deleted_at', null)
        .single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        const decryptedCredentials = decryptCredentials(
          data.database_connections.encrypted_credentials,
          data.database_connections.organizations.id,
          data.database_connections.organizations.created_at
        )
        const { username, password } = decryptedCredentials
        const snowflakeQueryId = data.result_url.split('/').pop()
        const cancelResp = await fetch(
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
              statement: `SELECT system$cancel_query('${snowflakeQueryId}')`,
            }),
          }
        )
        console.log('\nQuery status resp: ', cancelResp)
        if (cancelResp.status === 200) {
          res.status(200).json({})
        } else {
          res.status(500).json({ error: 'Error cancelling query' })
        }
      } else {
        const errorMessage = 'Query not found'
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

export default Sentry.withSentryAPI(
  handler,
  '/api/v1/database-queries/[databaseQueryId]/cancel'
)
