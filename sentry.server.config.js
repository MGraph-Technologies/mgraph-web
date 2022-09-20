// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENV = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;

Sentry.init({
  dsn: SENTRY_DSN || 'https://635f3ed164e24f9da5066ae809e440d9@o1418464.ingest.sentry.io/6761614',
  environment: SENTRY_ENV,
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
