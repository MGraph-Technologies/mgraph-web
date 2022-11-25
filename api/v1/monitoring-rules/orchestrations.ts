import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { parseExpression } from 'cron-parser'
import { isValidCron } from 'cron-validator'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { getBaseUrl } from '../../../utils/appBaseUrl'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

// TODO: achieve DRY with api/v1/refresh-jobs/orchestrations
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/monitoring-rules/orchestrations...')
  const method = req.method
  if (method === 'POST') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(
      supabaseUrl || '',
      supabaseServiceRoleKey || ''
    )

    // send other pending monitoring rule evaluations to finisher
    console.log('\nProgressing other pending monitoring rule evaluations...')
    try {
      const {
        data: MREData,
        error: MREError,
        status: MREStatus,
      } = await supabase
        .from('monitoring_rule_evaluations')
        .select(`id, monitoring_rule_id`)
        .eq('status', 'pending')

      if (MREError && MREStatus !== 406) {
        throw MREError
      }

      if (MREData) {
        MREData.forEach(async (evaluation) => {
          console.log(
            `\nMonitoring rule evaluation ${evaluation.id} is pending notification. Sending to finisher...`
          )
          const finisherRespPromise = fetch(
            getBaseUrl() +
              `/api/v1/monitoring-rules/${evaluation.monitoring_rule_id}/evaluations/${evaluation.id}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'supabase-service-role-key': supabaseServiceRoleKey,
              },
            }
          )
          console.log(
            `\nFinisher promise for monitoring rule evaluation ${evaluation.id}: `,
            finisherRespPromise
          )
        })
      }

      // send this-minuted-scheduled monitoring rule evaluations to initiator
      console.log(
        '\nInitiating this-minute-scheduled monitoring rule evaluations...'
      )
      type MonitoringRule = {
        id: string
        schedule: string
      }
      const {
        data: MRData,
        error: MRError,
        status: MRStatus,
      } = await supabase
        .from('monitoring_rules')
        .select(`id, schedule`)
        .is('deleted_at', null)

      if (MRError && MRStatus !== 406) {
        throw MRError
      }

      if (MRData) {
        MRData.forEach(async (monitoringRule: MonitoringRule) => {
          console.log(
            `\nMonitoring rule ${monitoringRule.id} has schedule ${monitoringRule.schedule}. Checking if it should run now...`
          )
          if (monitoringRule.schedule && isValidCron(monitoringRule.schedule)) {
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
            const interval = parseExpression(monitoringRule.schedule, {
              utc: true,
            })
            const next = interval.next()
            const prev = interval.prev()
            if (
              (next.getTime() >= minuteStart.getTime() &&
                next.getTime() < minuteEnd.getTime()) ||
              (prev.getTime() >= minuteStart.getTime() &&
                prev.getTime() < minuteEnd.getTime())
            ) {
              console.log(
                `\nMonitoring rule ${monitoringRule.id} is scheduled to run this minute. Sending to initiator...`
              )
              const initiatorRespPromise = fetch(
                getBaseUrl() + `/api/v1/monitoring-rules/${monitoringRule.id}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'supabase-service-role-key': supabaseServiceRoleKey,
                  },
                }
              )
              console.log(
                `\nInitiator promise for monitoring rule ${monitoringRule.id}: `,
                initiatorRespPromise
              )
            }
          }
        })
      }

      // let requests finish before returning
      setTimeout(() => {
        console.log('\nReturning successfully...')
        return res.status(200).json({})
      }, 1000)
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
