import { withSentry } from '@sentry/nextjs'
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import { getQueryParameters, parameterizeStatement } from '../../../../../utils/queryParameters'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/refresh-jobs/[refreshJobId]...')
  const method = req.method
  if (method === 'POST') {
    const supabaseServiceRoleKey = 
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { refreshJobId } = req.query
    console.log(`\nrefreshJobId: ${refreshJobId}`)
    try {
      // get refresh job record
      const { data: refreshJobData, error: refreshJobError, status: refreshJobStatus } = await supabase
        .from('refresh_jobs')
        .select('organization_id, email_to, slack_to')
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
        process.env.API_BASE_URL + `/api/v1/graphs/${refreshJobData.organization_id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'supabase-access-token': supabaseServiceRoleKey,
          },
        }
      )
      const graphData = await graphResp.json()
      const graph = graphData.graph
      const metricNodes = graph.nodes.filter((node: any) => node.data.sourceCode)
      
      // get organization's query parameters
      const queryParameters = await getQueryParameters(refreshJobData.organization_id, supabase)

      // for each metric node, parameterize its query and send to query runner
      metricNodes.forEach(async (node: any) => {
        const statement = node.data.sourceCode as string
        const databaseConnectionId = node.data.sourceDatabaseConnectionId as string
        if (statement && databaseConnectionId) {
          const parameterizedStatement = parameterizeStatement(statement, queryParameters)
          console.log(`\nExecuting query for node ${node.id}...`)
          fetch(process.env.API_BASE_URL + '/api/v1/database-queries', {
            method: 'POST',
            body: JSON.stringify({
              databaseConnectionId: databaseConnectionId,
              parentNodeId: node.id,
              statement: parameterizedStatement,
            }),
            headers: {
              'supabase-access-token': supabaseServiceRoleKey,
            },
          })
        }
      })

      await logRefreshJobRun(
        refreshJobId as string,
        supabase,
        refreshJobData.slack_to || refreshJobData.email_to ? 'pending_notification' : 'success'
      )
      return res.status(200).json({})
    } catch (error: any) {
      console.log('\nError: ', error.message)
      await logRefreshJobRun(refreshJobId as string, supabase, 'error')
      return res.status(500).json({
        error: error.message,
      })
    }
  } else {
    console.log('\nUnsupported method: ', method)
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }
}

const logRefreshJobRun = async (refreshJobId: string, supabase: SupabaseClient, status: string) => {
    let { data: refreshJobRunData, error: refreshJobRunError, status: refreshJobRunStatus } = await supabase
      .from('refresh_job_runs')
      .insert([
        {
          refresh_job_id: refreshJobId,
          status: status,
        },
      ])
      .single()

    if (refreshJobRunError && refreshJobRunStatus !== 406) {
      console.log('\nError: refreshJobRunError')
    }

    if (refreshJobRunData) {
      console.log(`\nRefresh job run ${refreshJobRunData.id} created with status ${status}.`)
    }
}

export default withSentry(handler)