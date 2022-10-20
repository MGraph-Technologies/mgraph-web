import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

import {
  decryptCredentials,
  makeToken,
} from '../../../../../utils/snowflakeCrypto'

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

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    supabase.auth.setAuth(accessToken)
    try {
      let { data, error, status } = await supabase
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
        const { account, username, privateKeyString, privateKeyPassphrase } =
          decryptCredentials(
            data.database_connections.encrypted_credentials,
            data.database_connections.organizations.id,
            data.database_connections.organizations.created_at
          )
        const token = makeToken(
          account,
          username,
          privateKeyString,
          privateKeyPassphrase
        )

        const cancelResp = await fetch(data.result_url + '/cancel', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'User-Agent': 'MGraph/1.0',
            'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
          },
        })
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
    } catch (error: any) {
      console.error('\nError: ', error.message)
      return res.status(500).json({
        error: error.message,
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
