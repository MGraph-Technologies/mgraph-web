import { withSentry } from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import {
  MonitoringRuleEvaluationStatus,
  MonitoringRuleProperties,
} from '../../../../../components/MonitoringRulesTable'
import {
  QueryData,
  QueryRow,
} from '../../../../../components/graph/QueryRunner'
import { getBaseUrl } from '../../../../../utils/appBaseUrl'
import {
  checkColumnsStructure,
  getLatestQueryId,
  getQueryParameters,
  overrideQueryParameters,
  parameterizeStatement,
  snowflakeDateToJsDate,
  sortQueryRowsByDate,
} from '../../../../../utils/queryUtils'
import { MetricNodeProperties } from '../../../../../components/graph/MetricNode'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const MONITORING_RULE_EVALUATION_TIMEOUT_SECONDS = 3600

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/monitoring-rules/[monitoringRuleId]/runs/[runId]...'
  )
  const method = req.method
  if (method === 'PATCH') {
    const supabaseServiceRoleKey =
      (req.headers['supabase-service-role-key'] as string) || ''
    const supabase = createClient(
      supabaseUrl || '',
      supabaseServiceRoleKey || ''
    )
    const { monitoringRuleId, evaluationId } = req.query
    console.log(`\nmonitoringRuleId: ${monitoringRuleId}`)
    console.log(`\nevaluationId: ${evaluationId}`)
    try {
      // get monitoring rule evaluation record
      const {
        data: monitoringRuleEvaluationData,
        error: monitoringRuleEvaluationError,
        status: monitoringRuleEvaluationStatus,
      } = await supabase
        .from('monitoring_rule_evaluations')
        .select('created_at')
        .eq('id', evaluationId)
        .single()

      if (
        monitoringRuleEvaluationError &&
        monitoringRuleEvaluationStatus !== 406
      ) {
        throw monitoringRuleEvaluationError
      }

      if (!monitoringRuleEvaluationData) {
        throw new Error('Monitoring rule not found.')
      }

      // get monitoring rule record
      const {
        data: monitoringRuleData,
        error: monitoringRuleError,
        status: monitoringRuleStatus,
      } = await supabase
        .from('monitoring_rules')
        .select(
          'organization_id, parent_node_id, properties, email_to, slack_to, organizations ( name )'
        )
        .eq('id', monitoringRuleId)
        .single()

      if (monitoringRuleError && monitoringRuleStatus !== 406) {
        throw monitoringRuleError
      }

      if (!monitoringRuleData) {
        throw new Error('Monitoring rule not found.')
      }

      const organizationName = monitoringRuleData.organizations.name
      const monitoringRuleProperties =
        monitoringRuleData.properties as MonitoringRuleProperties
      console.log(
        `\nmonitoringRuleProperties:`,
        JSON.stringify(monitoringRuleProperties)
      )
      const {
        alertIfValue,
        rangeLowerBound,
        rangeUpperBound,
        lookbackPeriods,
        queryParameterOverrides,
      } = monitoringRuleProperties

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

      const metricNodeProperties =
        metricNodeData.properties as MetricNodeProperties

      let evaluationStatus: MonitoringRuleEvaluationStatus = 'ok'
      const evaluationAlerts: string[] = []
      const processAlert = (alert: string) => {
        console.log('\n' + alert)
        evaluationStatus = 'alert'
        if (monitoringRuleData.slack_to) {
          sendSlackAlerts(
            alert,
            monitoringRuleData.slack_to,
            metricNodeProperties,
            organizationName
          )
        }
        evaluationAlerts.push(alert)
      }

      // check for timeout
      const timeoutThreshold = new Date(
        Date.now() - MONITORING_RULE_EVALUATION_TIMEOUT_SECONDS * 1000
      )
      if (monitoringRuleEvaluationData.created_at < timeoutThreshold) {
        // terminate early
        processAlert('Monitoring rule evaluation timed out.')
        evaluationStatus = 'timed_out' // override processAlert
      } else {
        // try to evaluate monitoring rule
        // get organization's query parameters
        let queryParameters = await getQueryParameters(
          monitoringRuleData.organization_id,
          supabase
        )

        // queryParameterOverrides
        queryParameters = overrideQueryParameters(
          queryParameters,
          queryParameterOverrides
        )

        // get query results
        const parameterizedStatement = parameterizeStatement(
          metricNodeProperties.source?.query,
          queryParameters
        )
        console.log(
          `\nGetting latest query id for node ${parentNodeId} and statement: ${parameterizedStatement}`
        )
        const latestQueryId = await getLatestQueryId(
          parameterizedStatement,
          metricNodeProperties.source?.databaseConnectionId,
          parentNodeId,
          supabase
        )
        console.log(
          `\nLatest query id for node ${parentNodeId}: ${latestQueryId}`
        )
        if (!latestQueryId) {
          throw new Error('Query not found.')
        }
        console.log(`\nGetting query status for query id ${latestQueryId}...`)
        const queryResultResp = await fetch(
          getBaseUrl() + `/api/v1/database-queries/${latestQueryId}/results`,
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

        // evaluate monitoring rule
        if (queryStatus === 202) {
          console.log(`\nQuery is still running. Skipping evaluation.`)
          return res.status(202).json({})
        } else {
          console.log(`\nEvaluating monitoring rule...`)
          if (queryStatus !== 200) {
            processAlert(
              `Monitoring rule failed to evaluate: query status ${queryStatus}.`
            )
          } else {
            const queryData = (await queryResultResp.json()) as QueryData
            if (!checkColumnsStructure(queryData)) {
              processAlert(
                `Monitoring rule failed to evaluate: query result does not have the expected columns structure.`
              )
            } else {
              const rows = sortQueryRowsByDate(queryData.rows)
              const dimensions = Array.from(
                new Set(rows.map((row: QueryRow) => row[1]))
              )
              dimensions.forEach((dimension: string) => {
                const dimensionRows = rows.filter(
                  (row: QueryRow) => row[1] === dimension
                )
                const dimensionRowsToEval = dimensionRows.slice(
                  -lookbackPeriods
                )
                dimensionRowsToEval.forEach((row) => {
                  const date = snowflakeDateToJsDate(row[0])
                  const dimension = row[1]
                  const value = parseFloat(row[2])
                  if (
                    alertIfValue === 'insideRangeInclusive' &&
                    value >= rangeLowerBound &&
                    value <= rangeUpperBound
                  ) {
                    processAlert(
                      `Value ${value} for dimension ${dimension} on ${date.toISOString()} is inside the range [${rangeLowerBound}, ${rangeUpperBound}].`
                    )
                  } else if (
                    alertIfValue === 'outsideRangeExclusive' &&
                    (value < rangeLowerBound || value > rangeUpperBound)
                  ) {
                    processAlert(
                      `Value ${value} for dimension ${dimension} on ${date.toISOString()} is outside the range (${rangeLowerBound}, ${rangeUpperBound}).`
                    )
                  }
                })
              })
            }
          }
        }
      }
      console.log(
        `\nSuccess. Updating monitoring_rule_evaluations record ${evaluationId}...`
      )
      const {
        data: monitoringRuleEvaluationUpdateData,
        error: monitoringRuleEvaluationUpdateError,
      } = await supabase
        .from('monitoring_rule_evaluations')
        .update({
          status: evaluationStatus,
          alerts: evaluationAlerts,
          updated_at: new Date(),
        })
        .eq('id', evaluationId)
        .single()

      if (monitoringRuleEvaluationUpdateError) {
        throw monitoringRuleEvaluationUpdateError
      }

      if (!monitoringRuleEvaluationUpdateData) {
        throw new Error('Monitoring rule evaluation not found.')
      }

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

const sendSlackAlerts = async (
  alert: string,
  slackTo: string,
  metricNodeProperties: MetricNodeProperties,
  organizationName: string
) => {
  const slackWebhooks = slackTo.split(',')
  console.log(`\nBeginning slack messaging...`)
  const organizationNameEncoded = encodeURIComponent(organizationName)
  slackWebhooks.forEach(async (slackWebhook: string) => {
    const body = {
      text: `Alert on metric ${metricNodeProperties.name}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:warning: Alert on metric ${metricNodeProperties.name}*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Alert: ${alert}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `${getBaseUrl()}/${organizationNameEncoded}/metrics/${
                metricNodeProperties.id
              }#monitoring-rules`,
            },
          ],
        },
      ],
    }
    console.log(`\nSending slack message to ${slackWebhook} with body:`, body)
    const slackResp = await fetch(slackWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    console.log(`\nSlack response: ${slackResp.status}`)
  })
}
