import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { QueryError } from '../../../../components/graph/QueryRunner'
import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'
import { getBaseUrl } from '../../../../utils/appBaseUrl'
import {
  QueryColumn,
  QueryData,
  QueryDataType,
  QueryRow,
  isVerifiedMetricData,
} from '../../../../utils/queryUtils'
import {
  decryptCredentials,
  formJdbcUrl,
} from '../../../../utils/snowflakeCrypto'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const SNOWFLAKE_DATE_TYPES = [
  'DATE',
  'TIMESTAMP',
  'TIMESTAMPNTZ',
  'TIMESTAMPLTZ',
  'TIMESTAMPTZ',
]
const SNOWFLAKE_NUMBER_TYPES = [
  'DECIMAL',
  'DOUBLE',
  'DOUBLE PRECISION',
  'FIXED',
  'FLOAT',
  'FLOAT4',
  'FLOAT8',
  'INTEGER',
  'NUMBER',
  'NUMERIC',
  'REAL',
]

const snowflakeDateToJsDate = (snowflakeDate: string) => {
  // strip tz info
  const _snowflakeDate = snowflakeDate.replace(/(Z|[-+]\d{2}:\d{2})$/, '')
  const date = new Date(_snowflakeDate + 'Z')
  return date
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/database-queries/[databaseQueryId]/results...'
  )
  const method = req.method
  if (method === 'GET') {
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
          'result_url, created_at, database_connections (encrypted_credentials, organizations (id, created_at))'
        )
        .eq('id', databaseQueryId)
        .is('deleted_at', null)
        .single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        const databaseQuery = data as {
          result_url: string
          created_at: string
          database_connections: {
            encrypted_credentials: string
            organizations: {
              id: string
              created_at: string
            }
          }
        }
        const queryCreated = new Date(databaseQuery.created_at)
        const now = new Date()
        const diff = now.getTime() - queryCreated.getTime()
        const diffHours = Math.round(diff / (1000 * 60 * 60))
        if (diffHours > 24) {
          console.log('\nQuery expired')
          return res.status(410).json({
            error: 'Results expired',
          } as QueryError)
        }

        const decryptedCredentials = decryptCredentials(
          databaseQuery.database_connections.encrypted_credentials,
          databaseQuery.database_connections.organizations.id,
          databaseQuery.database_connections.organizations.created_at
        )
        const { username, password } = decryptedCredentials
        const snowflakeQueryId = databaseQuery.result_url.split('/').pop()
        const queryStatusResp = await fetch(
          getBaseUrl() + `/api/v1/database-queries/snowflake-jdbc-proxy`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Snowflake-JDBC-URL': formJdbcUrl(decryptedCredentials),
              'Snowflake-Username': username,
              'Snowflake-Password': password,
              'Snowflake-Query-Id': snowflakeQueryId || '',
            },
          }
        )
        console.log('\nQuery status resp: ', queryStatusResp)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queryStatus = (await queryStatusResp.json()) as any
        if (queryStatusResp.status === 200) {
          console.log('\nQuery successful, relaying results...')
          const columns: QueryColumn[] =
            queryStatus.resultSetMetaData.rowType.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (col: any) => {
                let colType: QueryDataType = 'string'
                if (SNOWFLAKE_DATE_TYPES.includes(col.type)) {
                  colType = 'date'
                } else if (SNOWFLAKE_NUMBER_TYPES.includes(col.type)) {
                  colType = 'number'
                }
                return {
                  name: col.name,
                  type: colType,
                } as QueryColumn
              }
            )
          const rows = queryStatus.data as QueryRow[]
          // Verify
          const metricDataVerified = isVerifiedMetricData(columns, rows)
          // Convert values
          rows.forEach((row) => {
            row.forEach((val, i) => {
              let newVal = val
              // Convert null values
              if (val === 'convert_to_null') {
                newVal = null
              }
              // Convert Snowflake date types
              if (newVal && columns[i].type === 'date') {
                newVal = snowflakeDateToJsDate(newVal as string)
                // Convert Snowflake number types
              } else if (newVal && columns[i].type === 'number') {
                newVal = Number(newVal)
              }
              if (newVal !== val) {
                row[i] = newVal
              }
            })
          })
          // sort rows equivalent to ORDER BY columns.length, columns.length - 1, ..., 1
          for (let i = columns.length - 1; i >= 0; i--) {
            rows.sort((a, b) => {
              const aStr = a[i] ? JSON.stringify(a[i]) : ''
              const bStr = b[i] ? JSON.stringify(b[i]) : ''
              return aStr.localeCompare(bStr)
            })
          }
          const executedAt = new Date(databaseQuery.created_at)
          res.setHeader('Cache-Control', 'max-age=31536000')
          return res.status(200).json({
            columns: columns,
            rows: rows,
            executedAt: executedAt,
            metricDataVerified: metricDataVerified,
          } as QueryData)
        } else if (queryStatusResp.status === 202) {
          console.log('\nQuery still processing')
          return res.status(202).json({})
        } else if (queryStatusResp.status === 422) {
          console.log('\nQuery failed')
          return res.status(422).json({
            error: queryStatus.message,
          } as QueryError)
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

export default Sentry.withSentryAPI(
  handler,
  '/api/v1/database-queries/[databaseQueryId]/results'
)
