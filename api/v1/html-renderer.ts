import * as Sentry from '@sentry/nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { SENTRY_CONFIG } from '../../sentry.server.config.js'

Sentry.init(SENTRY_CONFIG)

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { srcDoc } = req.query

  const decodedSrcDoc = decodeURIComponent(srcDoc as string)

  res.setHeader('Content-Type', 'text/html')
  res.status(200).send(decodedSrcDoc)
}

export default Sentry.withSentryAPI(handler, 'api/v1/html-renderer')
