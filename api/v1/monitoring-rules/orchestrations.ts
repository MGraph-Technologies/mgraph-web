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

    // send pending monitoring rule evaluations to finisher
    console.log('\nProgressing pending monitoring rule evaluations...')
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

      const finisherResponses: {
        [monitoringRuleEvaluationId: string]: number
      } = {}
      if (MREData) {
        MREData.forEach(async (evaluation) => {
          console.log(
            `\nMonitoring rule evaluation ${evaluation.id} is pending notification. Sending to finisher...`
          )
          const finisherResp = await fetch(
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
            `\nFinisher status for monitoring rule evaluation ${evaluation.id}: `,
            finisherResp.status
          )
          finisherResponses[evaluation.id] = finisherResp.status
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

      const initiatorResponses: { [monitoringRuleId: string]: number } = {}
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
              const initiatorResp = await fetch(
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
                `\nInitiator status for monitoring rule ${monitoringRule.id}: `,
                initiatorResp.status
              )
              initiatorResponses[monitoringRule.id] = initiatorResp.status
            }
          }
        })
      }

      // force awaiting all responses before sending response
      const finisherStatusCounts = Object.values(finisherResponses).reduce(
        (acc, status) => {
          if (acc[status]) {
            acc[status] += 1
          } else {
            acc[status] = 1
          }
          return acc
        },
        {} as { [status: number]: number }
      )
      console.log('\nFinisher statuses:', JSON.stringify(finisherStatusCounts))
      const initiatorStatusCounts = Object.values(initiatorResponses).reduce(
        (acc, status) => {
          if (acc[status]) {
            acc[status] += 1
          } else {
            acc[status] = 1
          }
          return acc
        },
        {} as { [status: number]: number }
      )
      console.log(
        '\nInitiator statuses:',
        JSON.stringify(initiatorStatusCounts)
      )
      console.log('\nReturning successfully...')
      res.status(200).json({
        finisherResponses: finisherStatusCounts,
        initiatorResponses: initiatorStatusCounts,
      })
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
