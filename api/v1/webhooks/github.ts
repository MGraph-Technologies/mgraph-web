import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { NextApiRequest, NextApiResponse } from 'next'
import getUuid from 'uuid-by-string'

import { SENTRY_CONFIG } from '../../../sentry.server.config.js'

Sentry.init(SENTRY_CONFIG)

const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/webhooks/github...')
  console.log('Headers: ', req.headers)
  console.log('Body: ', req.body)
  const method = req.method
  if (method === 'POST') {
    // Verify the signature
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const hmac = crypto.createHmac('sha256', githubWebhookSecret!)
    const digest = Buffer.from(
      'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex'),
      'utf8'
    )
    const checksum = Buffer.from(
      req.headers['x-hub-signature-256'] as string,
      'utf8'
    )
    if (
      checksum.length !== digest.length ||
      !crypto.timingSafeEqual(digest, checksum)
    ) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Verify the event type
    const eventType = req.headers['x-github-event'] as string
    if (eventType !== 'installation') {
      return res.status(400).json({ error: 'Unsupported event type' })
    }

    // Verify the app slug (currently we have only one app: MGraph dbt Sync)
    const appSlug = req.body.installation.app_slug
    if (!appSlug.includes('mgraph-dbt-sync')) {
      return res.status(400).json({ error: 'Unsupported app' })
    }

    // Create graph_syncs supabase record
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const supabase = createClient(
        supabaseUrl || '',
        supabaseServiceRoleKey || ''
      )

      const installationId = req.body.installation.id
      let toUpsert = {
        id: getUuid(appSlug + installationId), // idempotent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any

      const bodyAction = req.body.action as 'created' | 'deleted'
      if (bodyAction === 'created') {
        const {
          data: graphSyncTypeData,
          error: graphSyncTypeError,
          status: graphSyncTypeStatus,
        } = await supabase
          .from('graph_sync_types')
          .select('id')
          .eq('name', 'dbt Project')
          .single()

        if (graphSyncTypeError && graphSyncTypeStatus !== 406) {
          throw graphSyncTypeError
        }

        const graphSyncType = graphSyncTypeData as { id: string }
        const graphSyncTypeId = graphSyncType.id
        toUpsert = {
          ...toUpsert,
          /* will set organization_id and name on client callback
            since state isn't available in the webhook payload */
          organization_id: null,
          type_id: graphSyncTypeId,
          name: 'dbt Project', // placeholder
          properties: {
            installationId: installationId,
          },
          encrypted_credentials: null,
          created_at: new Date(),
          updated_at: new Date(),
        }
      } else if (bodyAction === 'deleted') {
        const {
          data: prexistingGraphSyncData,
          error: prexistingGraphSyncError,
          status: prexistingGraphSyncStatus,
        } = await supabase
          .from('graph_syncs')
          .select('*')
          .eq('id', toUpsert.id)
          .single()

        if (prexistingGraphSyncError && prexistingGraphSyncStatus !== 406) {
          throw prexistingGraphSyncError
        }

        toUpsert = {
          ...toUpsert,
          ...prexistingGraphSyncData, // keep existing properties
          deleted_at: new Date(),
        }
      } else {
        return res.status(400).json({ error: 'Unsupported action' })
      }

      console.log('Upserting graph_syncs record: ', toUpsert)
      const { data, error } = await supabase
        .from('graph_syncs')
        .upsert(toUpsert)
        .select('*')
        .single()

      if (error) {
        throw error
      }

      if (data) {
        console.log('Upserted graph_syncs record: ', data)
        return res.status(200).json({})
      } else {
        console.log('No data returned from graph_syncs upsert')
        return res.status(500).json({ error: 'Unknown error' })
      }
    } catch (error: unknown) {
      console.error(error)
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

export default Sentry.withSentryAPI(handler, 'api/v1/webhooks/github')
