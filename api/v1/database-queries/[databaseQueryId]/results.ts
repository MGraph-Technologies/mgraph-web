import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

import {
  QueryColumn,
  QueryData,
  QueryError,
  QueryRow,
} from '../../../../components/QueryRunner'
import {
  decryptCredentials,
  makeToken,
} from '../../../../utils/snowflakeCrypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/database-queries/[databaseQueryId]/results...'
  )
  const method = req.method
  if (method === 'GET') {
    console.log('\nQuery: ', req.query)
    const { databaseQueryId } = req.query

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    supabase.auth.setAuth(accessToken)
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

        const queryStatusResp = await fetch(data.result_url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            Accept: 'application/json',
            'User-Agent': 'MGraph/1.0',
            'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
          },
        })
        console.log('\nQuery status resp: ', queryStatusResp)

        const queryStatus = await queryStatusResp.json()
        if (queryStatusResp.status === 200) {
          console.log('\nQuery successful, relaying results...')
          const columns = queryStatus.resultSetMetaData.rowType.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (col: any) => {
              return {
                name: col.name,
                type: col.type,
              } as QueryColumn
            }
          )
          const rows = queryStatus.data as QueryRow[]
          const executedAt = new Date(queryStatus.createdOn)
          res.setHeader('Cache-Control', 'max-age=31536000')
          return res.status(200).json({
            columns: columns,
            rows: rows,
            executedAt: executedAt,
          } as QueryData)
        } else if (queryStatusResp.status === 202) {
          console.log('\nQuery still processing')
          return res.status(202).json({})
        } else if (queryStatusResp.status === 422) {
          if (queryStatus.message === 'Result not found') {
            console.log('\nQuery expired')
            return res.status(410).json({
              error: 'Results expired',
            } as QueryError)
          } else {
            console.log('\nQuery failed')
            return res.status(422).json({
              error: queryStatus.message,
            } as QueryError)
          }
        } else {
          console.error('\nError')
          return res.status(500).json({})
        }
      } else {
        const errorMessage = 'Query not found'
        console.error('\nError: ', errorMessage)
        return res.status(404).json({
          error: errorMessage,
        } as QueryError)
      }
    } catch (error: unknown) {
      console.error('\nError: ', error)
      return res.status(500).json({
        error: error,
      } as QueryError)
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({
      error: 'Method not allowed',
    } as QueryError)
  }
}

export default withSentry(handler)
