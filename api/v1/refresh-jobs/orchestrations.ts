import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { parseExpression } from 'cron-parser'
import { isValidCron } from 'cron-validator'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { getBaseUrl } from '../../../utils/appBaseUrl'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/refresh-jobs/orchestrations...')
  const method = req.method
  if (method === 'POST') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(
      supabaseUrl || '',
      supabaseServiceRoleKey || ''
    )

    // send pending refresh job runs to finisher
    console.log('\nProgressing pending refresh job runs...')
    try {
      const {
        data: RJRData,
        error: RJRError,
        status: RJRStatus,
      } = await supabase
        .from('refresh_job_runs')
        .select(`id, refresh_job_id`)
        .eq('status', 'pending')

      if (RJRError && RJRStatus !== 406) {
        throw RJRError
      }

      const finisherResponses: { [refreshJobRunId: string]: number } = {}
      if (RJRData) {
        RJRData.forEach(async (run) => {
          console.log(
            `\nRefresh job run ${run.id} is pending. Sending to finisher...`
          )
          const finisherResp = await fetch(
            getBaseUrl() +
              `/api/v1/refresh-jobs/${run.refresh_job_id}/runs/${run.id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'supabase-service-role-key': supabaseServiceRoleKey,
              },
            }
          )
          console.log(
            `\nFinisher status for refresh job run ${run.id}: `,
            finisherResp.status
          )
          finisherResponses[run.id] = finisherResp.status
        })
      }

      // send this-minuted-scheduled refresh job runs to initiator
      console.log('\nInitiating this-minute-scheduled refresh job runs...')
      type RefreshJob = {
        id: string
        schedule: string
      }
      const {
        data: RJData,
        error: RJError,
        status: RJStatus,
      } = await supabase
        .from('refresh_jobs')
        .select(`id, schedule`)
        .is('deleted_at', null)

      if (RJError && RJStatus !== 406) {
        throw RJError
      }

      const initiatorResponses: { [refreshJobId: string]: number } = {}
      if (RJData) {
        RJData.forEach(async (refreshJob: RefreshJob) => {
          console.log(
            `\nRefresh job ${refreshJob.id} has schedule ${refreshJob.schedule}. Checking if it should run now...`
          )
          if (refreshJob.schedule && isValidCron(refreshJob.schedule)) {
            const now = new Date()
            const minuteStart = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              now.getHours(),
              now.getMinutes()
            )
            const minuteEnd = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              now.getHours(),
              now.getMinutes() + 1
            )
            const interval = parseExpression(refreshJob.schedule, { utc: true })
            const next = interval.next()
            const prev = interval.prev()
            if (
              (next.getTime() >= minuteStart.getTime() &&
                next.getTime() < minuteEnd.getTime()) ||
              (prev.getTime() >= minuteStart.getTime() &&
                prev.getTime() < minuteEnd.getTime())
            ) {
              console.log(
                `\nRefresh job ${refreshJob.id} is scheduled to run this minute. Sending to initiator...`
              )
              const initiatorResp = await fetch(
                getBaseUrl() + `/api/v1/refresh-jobs/${refreshJob.id}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'supabase-service-role-key': supabaseServiceRoleKey,
                  },
                }
              )
              console.log(
                `\nInitiator status for refresh job ${refreshJob.id}: `,
                initiatorResp.status
              )
              initiatorResponses[refreshJob.id] = initiatorResp.status
            }
          }
        })
      }

      // avoid log clipping
      console.log('\nFinisher responses: ', JSON.stringify(finisherResponses))
      console.log('\nInitiator responses: ', JSON.stringify(initiatorResponses))
      console.log('\nReturning successfully...')
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

export default withSentry(handler)
