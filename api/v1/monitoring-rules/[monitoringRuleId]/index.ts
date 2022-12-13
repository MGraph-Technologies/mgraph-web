import * as Sentry from '@sentry/nextjs'
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'
import { getBaseUrl } from '../../../../utils/appBaseUrl'
import {
  QueryParameterOverrides,
  getQueryParameters,
  overrideQueryParameters,
  parameterizeStatement,
} from '../../../../utils/queryUtils'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/monitoring-rules/[monitoringRuleId]...'
  )
  const method = req.method
  if (method === 'POST') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(
      supabaseUrl || '',
      supabaseServiceRoleKey || ''
    )
    const { monitoringRuleId } = req.query
    console.log(`\nmonitoringRuleId: ${monitoringRuleId}`)
    try {
      // get monitoring rule record
      const {
        data: monitoringRuleData,
        error: monitoringRuleError,
        status: monitoringRuleStatus,
      } = await supabase
        .from('monitoring_rules')
        .select('organization_id, parent_node_id, properties')
        .eq('id', monitoringRuleId)
        .single()

      if (monitoringRuleError && monitoringRuleStatus !== 406) {
        throw monitoringRuleError
      }

      if (!monitoringRuleData) {
        throw new Error('Monitoring rule not found.')
      }

      // get parent metric node
      const parentNodeId = monitoringRuleData.parent_node_id
      const {
        data: metricNodeData,
        error: metricNodeError,
        status: metricNodeStatus,
      } = await supabase
        .from('nodes')
        .select('properties')
        .eq('id', parentNodeId)
        .single()

      if (metricNodeError && metricNodeStatus !== 406) {
        throw metricNodeError
      }

      if (!metricNodeData) {
        throw new Error('Parent metric node not found.')
      }

      // get organization's query parameters
      let queryParameters = await getQueryParameters(
        monitoringRuleData.organization_id,
        supabase
      )

      // queryParameterOverrides
      const queryParameterOverrides = monitoringRuleData.properties
        ?.queryParameterOverrides as QueryParameterOverrides
      queryParameters = overrideQueryParameters(
        queryParameters,
        queryParameterOverrides
      )

      // parameterize metric node query and send to query runner
      const parameterizedStatement = parameterizeStatement(
        metricNodeData.properties?.source?.query,
        queryParameters
      )
      console.log(`\nExecuting query for node ${parentNodeId}...`)
      fetch(getBaseUrl() + '/api/v1/database-queries', {
        method: 'POST',
        body: JSON.stringify({
          databaseConnectionId:
            metricNodeData.properties?.source?.databaseConnectionId,
          parentNodeId: parentNodeId,
          statement: parameterizedStatement,
        }),
        headers: {
          'supabase-access-token': supabaseServiceRoleKey,
        },
      })
        // force awaiting response before sending response
        .then((queryResp) => {
          console.log(
            `\nQuery for node ${parentNodeId} executed, status: ${queryResp.status}`
          )
          logMonitoringRuleEvaluation(
            monitoringRuleId as string,
            supabase,
            'pending'
          ).then(() => {
            console.log('\nReturning successfully...')
            return res.status(200).json({})
          })
        })
    } catch (error: unknown) {
      console.error('\nError: ', error)
      logMonitoringRuleEvaluation(
        monitoringRuleId as string,
        supabase,
        'error'
      ).then(() => {
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

const logMonitoringRuleEvaluation = async (
  monitoringRuleId: string,
  supabase: SupabaseClient,
  status: string
) => {
  const {
    data: monitoringRuleEvaluationData,
    error: monitoringRuleEvaluationError,
  } = await supabase
    .from('monitoring_rule_evaluations')
    .insert([
      {
        monitoring_rule_id: monitoringRuleId,
        status: status,
      },
    ])
    .single()

  if (monitoringRuleEvaluationError) {
    throw monitoringRuleEvaluationError
  }

  if (!monitoringRuleEvaluationData) {
    throw new Error('Monitoring rule evaluation was not inserted.')
  } else {
    console.log(
      `\nMonitoring rule evaluation ${monitoringRuleEvaluationData.id} created with status ${status}.`
    )
    return 'ok'
  }
}

export default Sentry.withSentryAPI(
  handler,
  'api/v1/monitoring-rules/[monitoringRuleId]'
)
