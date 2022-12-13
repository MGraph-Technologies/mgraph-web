import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import { Node } from 'react-flow-renderer'

import { Graph } from '../../../../../contexts/graph'
import { SENTRY_CONFIG } from '../../../../../sentry.server.config.js'
import { getBaseUrl } from '../../../../../utils/appBaseUrl'
import {
  getLatestQueryId,
  getQueryParameters,
  parameterizeStatement,
} from '../../../../../utils/queryUtils'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const REFRESH_JOB_RUN_TIMEOUT_SECONDS = 3600

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/refresh-jobs/[refreshJobId]/runs/[runId]...'
  )
  const method = req.method
  if (method === 'PATCH') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(
      supabaseUrl || '',
      supabaseServiceRoleKey || ''
    )
    const { refreshJobId, runId } = req.query
    console.log(`\nrefreshJobId: ${refreshJobId}`)
    console.log(`\nrunId: ${runId}`)
    try {
      // get refresh job run record
      const {
        data: refreshJobRunData,
        error: refreshJobRunError,
        status: refreshJobRunStatus,
      } = await supabase
        .from('refresh_job_runs')
        .select('created_at')
        .eq('id', runId)
        .single()

      if (refreshJobRunError && refreshJobRunStatus !== 406) {
        throw refreshJobRunError
      }

      if (!refreshJobRunData) {
        throw new Error('Refresh job run not found.')
      }

      // get refresh job record
      const {
        data: refreshJobData,
        error: refreshJobError,
        status: refreshJobStatus,
      } = await supabase
        .from('refresh_jobs')
        .select('organization_id, email_to, slack_to, organizations ( name )')
        .eq('id', refreshJobId)
        .single()

      if (refreshJobError && refreshJobStatus !== 406) {
        throw refreshJobError
      }

      if (!refreshJobData) {
        throw new Error('Refresh job not found.')
      }

      let runStatus: 'success' | 'timed_out' = 'success'

      // check for timeout
      const timeoutThreshold = new Date(
        Date.now() - REFRESH_JOB_RUN_TIMEOUT_SECONDS * 1000
      ).toISOString()
      if (refreshJobRunData.created_at < timeoutThreshold) {
        runStatus = 'timed_out'
      } else {
        // check processing status of all metrics' queries
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
        const graph = graphData.graph as Graph
        const metricNodes = graph.nodes.filter(
          (node: Node) => node.data.source?.query
        )

        // get organization's query parameters
        const queryParameters = await getQueryParameters(
          refreshJobData.organization_id,
          supabase
        )

        // for each metric node, parameterize its query and check whether it's still running
        // TODO: think up an implementation that doesn't check every query every time
        let queryStillRunning = false
        metricNodes.forEach(async (node: Node) => {
          const statement = node.data.source.query as string
          const databaseConnectionId = node.data.source
            .databaseConnectionId as string
          if (statement && databaseConnectionId) {
            const parameterizedStatement = parameterizeStatement(
              statement,
              queryParameters
            )
            console.log(
              `\nGetting latest query id for node ${node.id} and statement ${parameterizedStatement}`
            )
            const latestQueryId = await getLatestQueryId(
              parameterizedStatement,
              databaseConnectionId,
              node.id,
              supabase
            )
            console.log(
              `\nLatest query id for node ${node.id}: ${latestQueryId}`
            )
            if (latestQueryId) {
              console.log(
                `\nGetting query status for query id ${latestQueryId}...`
              )
              const queryResultResp = await fetch(
                getBaseUrl() +
                  `/api/v1/database-queries/${latestQueryId}/results`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'supabase-access-token': supabaseServiceRoleKey,
                  },
                }
              )
              const queryStatus = queryResultResp.status
              console.log(
                `\nQuery status for query id ${latestQueryId}: ${queryStatus}`
              )
              if (queryStatus === 202) {
                queryStillRunning = true
              }
            }
          }
        })

        if (queryStillRunning) {
          return res.status(202).json({})
        }
      }

      // send slack notification, if applicable
      let slackRequests = 0
      const slackResponses: { [webhookId: string]: number } = {}
      console.log(`\nNo queries are still running.`)
      if (refreshJobData.slack_to) {
        console.log(`\nBeginning slack messaging...`)
        const slackWebhooks = refreshJobData.slack_to.split(',')
        const organizationName = refreshJobData.organizations.name
        const organizationNameEncoded = encodeURIComponent(organizationName)
        const organizationNameWords = organizationName.split(' ')
        const organizationNameTitleCased = organizationNameWords
          .map((word: string) => {
            return word.charAt(0).toUpperCase() + word.slice(1)
          })
          .join(' ')
        const organizationNameTitleCasedWithApostrophe =
          organizationNameTitleCased.charAt(
            organizationNameTitleCased.length - 1
          ) === 's'
            ? `${organizationNameTitleCased}'`
            : `${organizationNameTitleCased}'s`
        slackWebhooks.forEach(async (slackWebhook: string) => {
          const body =
            runStatus === 'success'
              ? {
                  text: `${organizationNameTitleCasedWithApostrophe} MGraph has refreshed!`,
                  blocks: [
                    {
                      type: 'header',
                      text: {
                        type: 'plain_text',
                        text: `:chart_with_upwards_trend: :chart_with_upwards_trend: :chart_with_upwards_trend:`,
                        emoji: true,
                      },
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*${organizationNameTitleCasedWithApostrophe} MGraph has refreshed!*`,
                      },
                    },
                    {
                      type: 'section',
                      fields: [
                        {
                          type: 'mrkdwn',
                          text: `See the latest metrics here: ${getBaseUrl()}/${organizationNameEncoded}`,
                        },
                      ],
                    },
                  ],
                }
              : {
                  text: `A scheduled refresh of ${organizationNameTitleCasedWithApostrophe} MGraph has timed out`,
                  blocks: [
                    {
                      type: 'header',
                      text: {
                        type: 'plain_text',
                        text: `:warning: A scheduled refresh of ${organizationNameTitleCasedWithApostrophe} MGraph has timed out`,
                        emoji: true,
                      },
                    },
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `${getBaseUrl()}/${organizationNameEncoded}/settings/refresh-jobs`,
                      },
                    },
                  ],
                }
          console.log(
            `\nSending slack message to ${slackWebhook} with body:`,
            body
          )
          slackRequests++
          const slackResp = await fetch(slackWebhook, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          })
          console.log(`\nSlack response: ${slackResp.status}`)
          slackResponses[`${slackRequests} - ${slackWebhook}`] =
            slackResp.status // handle duplicate webhooks
        })
      }

      // force awaiting all responses before sending response
      while (slackRequests > Object.keys(slackResponses).length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      console.log('\nSlack responses: ', JSON.stringify(slackResponses))

      console.log(`\nUpdating refresh_job_runs record ${runId}...`)
      const { data: refreshJobRunUpdateData, error: refreshJobRunUpdateError } =
        await supabase
          .from('refresh_job_runs')
          .update({
            status: runStatus,
            updated_at: new Date(),
          })
          .eq('id', runId)
          .single()

      if (refreshJobRunUpdateError) {
        throw refreshJobRunUpdateError
      }

      if (!refreshJobRunUpdateData) {
        throw new Error('Refresh job run not found.')
      } else {
        console.log('\nReturning successfully...')
        return res.status(200).json({})
      }
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

export default Sentry.withSentryAPI(
  handler,
  'api/v1/refresh-jobs/[refreshJobId]/runs/[runId]'
)
