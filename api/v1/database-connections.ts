import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

import { SENTRY_CONFIG } from '../../sentry.server.config.js'
import {
  SnowflakeCredentials,
  encryptCredentials,
} from '../../utils/snowflakeCrypto'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/database-connections...')
  const method = req.method
  if (method === 'POST') {
    const body = JSON.parse(req.body)
    const { toUpsert, credentials } = body

    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })

    try {
      let _toUpsert = {
        ...toUpsert,
      }

      if (credentials) {
        const organizationId = toUpsert.organization_id
        const {
          data: organization,
          error: organizationError,
          status: organizationStatus,
        } = await supabase
          .from('organizations')
          .select('created_at')
          .eq('id', organizationId)
          .single()

        if (organizationError && organizationStatus !== 406) {
          throw organizationError
        }

        const organizationCreatedAt = organization.created_at
        const encryptedCredentials = encryptCredentials(
          credentials as SnowflakeCredentials,
          organizationId,
          organizationCreatedAt
        )
        _toUpsert = {
          ..._toUpsert,
          encrypted_credentials: encryptedCredentials,
        }
      }

      const { error, status } = await supabase
        .from('database_connections')
        .upsert(_toUpsert)
        .eq('id', _toUpsert.id)

      if (error && status !== 406) {
        throw error
      }

      return res.status(200).json({})
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

export default Sentry.withSentryAPI(handler, 'api/v1/database-connections')
