import { defineConfig } from 'cypress'

import getSession from './cypress/support/supabaseLogin'

require('dotenv').config()

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    blockHosts: ['*.segment.io'],
    chromeWebSecurity: false,
    retries: {
      runMode: 2,
      openMode: 2,
    },
    // 13" macbook
    viewportHeight: 1280,
    viewportWidth: 800,
    screenshotOnRunFailure: false,
    video: false,
    setupNodeEvents(on, config) {
      on('task', {
        getSupabaseSession({ email, password, supabaseUrl, supabaseAnonKey }) {
          return getSession({ email, password, supabaseUrl, supabaseAnonKey })
        },
      })
    },
  },
  env: {
    CYPRESS_TEST_ACCOUNT_EMAIL:
      process.env.NEXT_PUBLIC_CYPRESS_TEST_ACCOUNT_EMAIL,
    CYPRESS_TEST_ACCOUNT_PASSWORD:
      process.env.NEXT_PUBLIC_CYPRESS_TEST_ACCOUNT_PASSWORD,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
})
