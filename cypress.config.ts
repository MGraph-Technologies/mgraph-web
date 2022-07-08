import { defineConfig } from "cypress";

require('dotenv').config()

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3999',
    chromeWebSecurity: false,
    screenshotOnRunFailure: false,
    video: false
  },
  env: {
    cypressTestAccountEmail: process.env.NEXT_PUBLIC_CYPRESS_TEST_ACCOUNT_EMAIL,
    cypressTestAccountPassword: process.env.NEXT_PUBLIC_CYPRESS_TEST_ACCOUNT_PASSWORD
  }
});
