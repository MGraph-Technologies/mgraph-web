import * as Sentry from '@sentry/nextjs'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'
import { Edge, Node } from 'reactflow'

import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'
import { Graph } from '../../../../contexts/graph'
import { getBaseUrl } from '../../../../utils/appBaseUrl'
import { getConnectedObjects } from '../../../../utils/getConnectedObjects'

Sentry.init(SENTRY_CONFIG)

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log(
    '\n\nNew request to /api/v1/mbot/[organizationId]/graph-structure...'
  )
  const accessToken = (req.headers['supabase-access-token'] as string) || ''

  const { organizationId } = req.query
  console.log('organizationId: ', organizationId)

  const method = req.method
  if (method === 'GET') {
    try {
      const graphResp = await fetch(
        `${getBaseUrl()}/api/v1/graphs/${organizationId}`,
        {
          headers: {
            'supabase-access-token': accessToken,
          },
        }
      )
      const graphData = await graphResp.json()
      const graph = graphData.graph as Graph

      const metricNodes = graph.nodes.filter(
        (node: Node) => node.type === 'metric'
      )

      const graphStructure = []
      for (const metricNode of metricNodes) {
        graphStructure.push({
          metricId: metricNode.id,
          metricName: metricNode.data.name,
          inputMetricIds: getConnectedObjects(graph, metricNode, 1, 'inputs')
            .filter((node: Node | Edge) => node.type === 'metric')
            .map((node: Node | Edge) => node.id),
        })
      }
      console.log('graphStructure: ', graphStructure)
      return res.status(200).json({ graphStructure })
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
