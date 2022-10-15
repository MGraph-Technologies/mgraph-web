import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { parseExpression } from 'cron-parser'
import { isValidCron } from 'cron-validator'
import { NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const REFRESH_JOB_RUN_TIMEOUT_SECONDS = 3600

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/refresh-jobs/orchestrations...')
  const method = req.method
  if (method === 'POST') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // clean up timed out pending_notification refresh job runs
    console.log(
      '\nCleaning up timed out pending_notification refresh job runs...'
    )
    const timeoutThreshold = new Date(
      Date.now() - REFRESH_JOB_RUN_TIMEOUT_SECONDS * 1000
    ).toUTCString()
    try {
      let { data, error, status } = await supabase
        .from('refresh_job_runs')
        .update({
          status: 'notification_timed_out',
          updated_at: new Date(),
        })
        .eq('status', 'pending_notification')
        .lt('created_at', timeoutThreshold)
        .select('id')

      if (error && status !== 404) { // 404 means no rows were updated
        throw error
      }

      if (status === 404) {
        console.log('No timed out pending_notification refresh job runs found.')
      }

      if (data) {
        console.log(`Cleaned up ${data.length} timed out refresh job runs.`)
      }
    } catch (error: any) {
      console.error('\nError: ', error.message)
      return res.status(500).json({
        error: error.message,
      })
    }

    // send other pending_notification refresh job runs to finisher
    console.log('\nProgressing other pending_notification refresh job runs...')
    try {
      let { data, error, status } = await supabase
        .from('refresh_job_runs')
        .select(`id, refresh_job_id`)
        .eq('status', 'pending_notification')
        .gte('created_at', timeoutThreshold)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        data.forEach(async (run) => {
          console.log(
            `\nRefresh job run ${run.id} is pending notification. Sending to finisher...`
          )
          fetch(
            process.env.APP_BASE_URL +
              `/api/v1/refresh-jobs/${run.refresh_job_id}/runs/${run.id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'supabase-service-role-key': supabaseServiceRoleKey,
              },
            }
          )
        })
      }
    } catch (error: any) {
      console.error('\nError: ', error.message)
      return res.status(500).json({
        error: error.message,
      })
    }

    // send this-minuted-scheduled refresh job runs to initiator
    console.log('\nInitiating this-minute-scheduled refresh job runs...')
    try {
      let { data, error, status } = await supabase
        .from('refresh_jobs')
        .select(`id, schedule`)
        .is('deleted_at', null)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        data.forEach(async (refreshJob: any) => {
          console.log(
            `\nRefresh job ${refreshJob.id} has schedule ${refreshJob.schedule}. Checking if it should run now...`
          )
          if (refreshJob.schedule && isValidCron(refreshJob.schedule)) {
            let now = new Date()
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
              fetch(
                process.env.APP_BASE_URL +
                  `/api/v1/refresh-jobs/${refreshJob.id}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'supabase-service-role-key': supabaseServiceRoleKey,
                  },
                }
              )
            }
          }
        })
      }

      return res.status(200).json({})
    } catch (error: any) {
      console.error('\nError: ', error.message)
      return res.status(500).json({
        error: error.message,
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
