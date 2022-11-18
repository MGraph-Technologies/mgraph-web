import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import jwt from 'jsonwebtoken'
import getUuid from 'uuid-by-string'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const mgraphDbtSyncGithubAppId = process.env.MGRAPH_DBT_SYNC_GITHUB_APP_ID
const mgraphDbtSyncGithubAppPrivateKey =
  process.env.MGRAPH_DBT_SYNC_GITHUB_APP_PRIVATE_KEY

const getGitHubAppToken = async (appId: string, appPrivateKey: string) => {
  console.log('appId: ', appId)
  console.log('appPrivateKey length: ', appPrivateKey.length)
  console.log('appPrivateKey hash: ' + getUuid(appPrivateKey))
  const appTokenPayload = {
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 60 * 10,
    iss: appId,
  }
  const appToken = jwt.sign(appTokenPayload, appPrivateKey, {
    algorithm: 'RS256',
  })
  return appToken
}

const getGitHubAppInstallToken = async (
  appToken: string,
  installationId: string
) => {
  const resp = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appToken}`,
      },
    }
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const respBody = (await resp.json()) as any
  const installToken = respBody.token
  return installToken
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/graph-syncs/[graphSyncId]/client-tokens...'
  )
  const method = req.method
  if (method === 'GET') {
    const { graphSyncId } = req.query
    console.log('\ngraphSyncId: ', graphSyncId)
    try {
      const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
      const accessToken = (req.headers['supabase-access-token'] as string) || ''
      supabase.auth.setAuth(accessToken)

      const {
        data: graphSyncData,
        error: graphSyncError,
        status: graphSyncStatus,
      } = await supabase
        .from('graph_syncs')
        .select('properties, graph_sync_types ( name )')
        .eq('id', graphSyncId)
        .single()
      if (graphSyncError && graphSyncStatus !== 406) {
        throw graphSyncError
      }
      if (!graphSyncData) {
        throw new Error('No graph sync found with that id.')
      }
      console.log('\ngraphSyncData: ', graphSyncData)
      const graphSyncType = graphSyncData.graph_sync_types.name

      if (graphSyncType === 'dbt Project') {
        console.log('\ngraphSyncType is dbt Project')
        console.log('Making GitHub app token...')
        const installationId = graphSyncData.properties.installationId
        const appToken = await getGitHubAppToken(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          mgraphDbtSyncGithubAppId!,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          mgraphDbtSyncGithubAppPrivateKey!
        )
        console.log('\nMade appToken')
        console.log('\nMaking GitHub app install token...')
        const appInstallToken = await getGitHubAppInstallToken(
          appToken,
          installationId
        )
        console.log('\nMade appInstallToken')
        res.status(200).json({ token: appInstallToken })
      } else {
        // dunno how this would happen, but just in case
        const error = 'We only support dbt project graph syncs at this time.'
        console.error(error)
        throw new Error(error)
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

export default withSentry(handler)
