import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import { Graph } from '../../../../../../contexts/graph'

import { getLatestQueryId, getQueryParameters, parameterizeStatement } from '../../../../../../utils/queryParameters'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/refresh-jobs/[refreshJobId]/runs/[runId]...')
  const method = req.method
  if (method === 'PATCH') {
    const supabaseServiceRoleKey = 
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { refreshJobId, runId } = req.query
    console.log(`\nrefreshJobId: ${refreshJobId}`)
    console.log(`\nrunId: ${runId}`)
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
      const graph = graphData.graph as Graph
      const metricNodes = graph.nodes.filter((node: any) => node.data.sourceCode)
      
      // get organization's query parameters
      const queryParameters = await getQueryParameters(refreshJobData.organization_id, supabase)

      // for each metric node, parameterize its query and check whether it's still running
      // TODO: think up an implementation that doesn't check every query every time
      let queryStillRunning = false
      metricNodes.forEach(async (node: any) => {
        const statement = node.data.sourceCode as string
        const databaseConnectionId = node.data.sourceDatabaseConnectionId as string
        if (statement && databaseConnectionId) {
          console.log(`\nGetting latest query id for node ${node.id}...`)
          const parameterizedStatement = parameterizeStatement(statement, queryParameters)
          const latestQueryId = await getLatestQueryId(
            parameterizedStatement,
            databaseConnectionId,
            node.id,
            supabase,
          )
          console.log(`\nLatest query id for node ${node.id}: ${latestQueryId}`)
          if (latestQueryId) {
            console.log(`\nGetting query status for query id ${latestQueryId}...`)
            const queryResult = await fetch(
              process.env.API_BASE_URL + `/api/v1/database-queries/${latestQueryId}/results`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'supabase-access-token': supabaseServiceRoleKey,
                },
              }
            )
            const queryStatus = queryResult.status
            console.log(`\nQuery status for query id ${latestQueryId}: ${queryStatus}`)
            if (queryStatus === 202) {
              queryStillRunning = true
            }
          }
        }
      })
      
      if (queryStillRunning) {
        return res.status(202).json({})
      }

      // if no queries are still running, update the run record
      console.log(`\nNo queries are still running. Updating refresh_job_runs record ${runId}...`)
      const { data: refreshJobRunData, error: refreshJobRunError, status: refreshJobRunStatus } = await supabase
        .from('refresh_job_runs')
        .update({ 
          status: 'success',
          updated_at: new Date(),
        })
        .eq('id', runId)
        .single()

      if (refreshJobRunError && refreshJobRunStatus !== 406) {
        throw refreshJobRunError
      }

      if (!refreshJobRunData) {
        throw new Error('Refresh job run not found.')
      }

      // TODO: send email and/or slack notification

      return res.status(200).json({})
    } catch (error: any) {
      console.log('\nError: ', error.message)
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

export default withSentry(handler)
