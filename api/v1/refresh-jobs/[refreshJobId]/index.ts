import * as Sentry from '@sentry/nextjs'
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import { Node } from 'react-flow-renderer'

import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'
import { getBaseUrl } from '../../../../utils/appBaseUrl'
import {
  getQueryParameters,
  parameterizeStatement,
} from '../../../../utils/queryUtils'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/refresh-jobs/[refreshJobId]...')
  const method = req.method
  if (method === 'POST') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(
      supabaseUrl || '',
      supabaseServiceRoleKey || ''
    )
    const { refreshJobId } = req.query
    console.log(`\nrefreshJobId: ${refreshJobId}`)
    try {
      // get refresh job record
      const {
        data: refreshJobData,
        error: refreshJobError,
        status: refreshJobStatus,
      } = await supabase
        .from('refresh_jobs')
        .select('organization_id')
        .eq('id', refreshJobId)
        .single()

      if (refreshJobError && refreshJobStatus !== 406) {
        throw refreshJobError
      }

      if (!refreshJobData) {
        throw new Error('Refresh job not found.')
      }

      // get organization's metric nodes
      const graphResp = await fetch(
        getBaseUrl() + `/api/v1/graphs/${refreshJobData.organization_id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'supabase-access-token': supabaseServiceRoleKey,
          },
        }
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const graphData = (await graphResp.json()) as any
      const graph = graphData.graph
      const metricNodes = graph.nodes.filter(
        (node: Node) => node.data.source?.query
      )

      // get organization's query parameters
      const queryParameters = await getQueryParameters(
        refreshJobData.organization_id,
        supabase
      )

      // for each metric node, parameterize its query and send to query runner
      let refreshRequests = 0
      const refreshResponses: { [nodeId: string]: number } = {}
      metricNodes.forEach(async (node: Node) => {
        const statement = node.data.source.query as string
        const databaseConnectionId = node.data.source
          .databaseConnectionId as string
        if (statement && databaseConnectionId) {
          const parameterizedStatement = parameterizeStatement(
            statement,
            queryParameters
          )
          console.log(`\nExecuting query for node ${node.id}...`)
          refreshRequests++
          const queryResp = await fetch(
            getBaseUrl() + '/api/v1/database-queries',
            {
              method: 'POST',
              body: JSON.stringify({
                databaseConnectionId: databaseConnectionId,
                parentNodeId: node.id,
                statement: parameterizedStatement,
              }),
              headers: {
                'supabase-access-token': supabaseServiceRoleKey,
              },
            }
          )
          console.log(
            `\nQuery for node ${node.id} executed, status: ${queryResp.status}`
          )
          refreshResponses[node.id] = queryResp.status
        }
      })

      // force awaiting all responses before sending response
      while (refreshRequests > Object.keys(refreshResponses).length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      console.log('\nRefresh responses: ', JSON.stringify(refreshResponses))

      logRefreshJobRun(refreshJobId as string, supabase, 'pending').then(() => {
        console.log('\nReturning successfully...')
        return res.status(200).json({})
      })
    } catch (error: unknown) {
      console.error('\nError: ', error)
      logRefreshJobRun(refreshJobId as string, supabase, 'error').then(() => {
        return res.status(500).json({
          error: error,
        })
      })
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }
}

const logRefreshJobRun = async (
  refreshJobId: string,
  supabase: SupabaseClient,
  status: string
) => {
  const { data: refreshJobRunData, error: refreshJobRunError } = await supabase
    .from('refresh_job_runs')
    .insert([
      {
        refresh_job_id: refreshJobId,
        status: status,
      },
    ])
    .single()

  if (refreshJobRunError) {
    throw refreshJobRunError
  }

  if (!refreshJobRunData) {
    throw new Error('Refresh job run to be updated not found.')
  } else {
    console.log(
      `\nRefresh job run ${refreshJobRunData.id} created with status ${status}.`
    )
    return 'ok'
  }
}

export default Sentry.withSentryAPI(
  handler,
  'api/v1/refresh-jobs/[refreshJobId]/index'
)
