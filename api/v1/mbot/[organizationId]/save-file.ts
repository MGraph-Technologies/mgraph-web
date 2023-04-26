import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { decode } from 'base64-arraybuffer'
import { NextApiRequest, NextApiResponse } from 'next'

import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/mbot/[organizationId]/save-file...')
  const { organizationId } = req.query
  console.log('organizationId: ', organizationId)

  const method = req.method
  if (method === 'POST') {
    const body = JSON.parse(req.body)
    const { file, fileName } = body
    console.log('fileName: ', fileName)
    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
    try {
      const { data, error } = await supabase.storage
        .from('mbot')
        .upload(`organizations/${organizationId}/${fileName}`, decode(file), {
          upsert: true,
        })

      if (error) {
        throw error
      }

      if (data) {
        return res.status(200).json({ data: data })
      }
    } catch (error: unknown) {
      console.error('\nError: ', error)
      return res.status(500).json({
        error: error,
      })
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

export default Sentry.withSentryAPI(
  handler,
  'api/v1/mbot/[organizationId]/save-file'
)
