import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'

import {
  CustomNodeProperties,
  CustomNodeSource,
} from '../../../components/graph/CustomNode'
import { FunctionNodeProperties } from '../../../components/graph/FunctionNode'
import { InputEdgeProperties } from '../../../components/graph/InputEdge'
import { MetricNodeProperties } from '../../../components/graph/MetricNode'
import { MonitoringRuleEvaluationStatus } from '../../../components/graph/node_detail/MonitoringRulesTable'
import { SENTRY_CONFIG } from '../../../sentry.server.config.js'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/graphs/[organizationId]...')
  const accessToken = (req.headers['supabase-access-token'] as string) || ''
  const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { organizationId } = req.query
  console.log('organizationId: ', organizationId)

  const method = req.method
  if (method === 'GET') {
    try {
      const { data: nodesData, error: nodesError } = await supabase
        .from('nodes')
        .select(
          'properties, react_flow_meta, monitoring_rules ( id, latest_monitoring_rule_evaluations ( status ) )'
        )
        .eq('organization_id', organizationId)
        .is('deleted_at', null)
        .is('monitoring_rules.deleted_at', null)
        .is(
          'monitoring_rules.latest_monitoring_rule_evaluations.deleted_at',
          null
        )

      if (nodesError) {
        throw nodesError
      }

      const { data: edgesData, error: edgesError } = await supabase
        .from('edges')
        .select('properties, react_flow_meta')
        .eq('organization_id', organizationId)
        .is('deleted_at', null)

      if (edgesError) {
        throw edgesError
      }

      if (nodesData && edgesData) {
        const nodes = nodesData.map((n) => {
          const node = n.react_flow_meta
          const properties = n.properties
          if (node.type === 'custom') {
            node.data = {
              // explicit construction so properties added outside of react flow don't break it
              id: properties.id,
              organizationId: properties.organizationId,
              typeId: properties.typeId,
              name: properties.name,
              description: properties.description,
              owner: properties.owner,
              source: {
                html: properties.source?.html,
                css: properties.source?.css,
              } as CustomNodeSource,
              color: properties.color,
              setNodeDataToChange: () => {
                return
              },
            } as CustomNodeProperties
          }
          if (node.type === 'metric') {
            type MR = {
              id: string
              latest_monitoring_rule_evaluations: [
                { status: MonitoringRuleEvaluationStatus }
              ]
            }
            node.data = {
              // explicit construction so properties added outside of react flow don't break it
              id: properties.id,
              organizationId: properties.organizationId,
              typeId: properties.typeId,
              name: properties.name,
              description: properties.description,
              owner: properties.owner,
              source: {
                databaseConnectionId: properties.source?.databaseConnectionId,
                query: properties.source?.query,
                queryType: properties.source?.queryType,
                dbtProjectGraphSyncId: properties.source?.dbtProjectGraphSyncId,
                dbtProjectMetricPath: properties.source?.dbtProjectMetricPath,
              },
              color: properties.color,
              tablePosition: properties.tablePosition,
              setNodeDataToChange: () => {
                return
              },
              monitored: n.monitoring_rules?.length > 0,
              alert:
                n.monitoring_rules?.length > 0 &&
                n.monitoring_rules.some(
                  (mr: MR) => mr.latest_monitoring_rule_evaluations.length > 0
                )
                  ? n.monitoring_rules.some((mr: MR) => {
                      return (
                        mr.latest_monitoring_rule_evaluations.length > 0 &&
                        mr.latest_monitoring_rule_evaluations.some((mre) =>
                          ['alert', 'timed_out'].includes(mre.status)
                        )
                      )
                    })
                  : undefined,
            } as MetricNodeProperties
          }
          if (node.type === 'function') {
            node.data = {
              id: properties.id,
              organizationId: properties.organizationId,
              typeId: properties.typeId,
              functionTypeId: properties.functionTypeId,
              color: properties.color,
              setNodeDataToChange: () => {
                return
              },
            } as FunctionNodeProperties
          }
          return node
        })
        const edges = edgesData.map((e) => {
          const edge = e.react_flow_meta
          const properties = e.properties
          edge.data = {
            id: properties.id,
            organizationId: properties.organizationId,
            typeId: properties.typeId,
            sourceId: properties.sourceId,
            targetId: properties.targetId,
          } as InputEdgeProperties
          return edge
        })
        const graph = {
          nodes: nodes,
          edges: edges,
        }
        return res.status(200).json({
          graph: graph,
        })
      }
    } catch (error: unknown) {
      console.error('\nError: ', error)
      return res.status(500).json({
        error: error,
      })
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

export default Sentry.withSentryAPI(handler, 'api/v1/graphs/[organizationId]')
