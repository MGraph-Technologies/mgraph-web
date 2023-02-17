// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

import { Session } from '@supabase/supabase-js'

const getSupabaseProjectId = () => {
  const supabaseUrl = Cypress.env('SUPABASE_URL')
  return supabaseUrl.split('//')[1].split('.')[0]
}

Cypress.Commands.add('insertCustomNode', (nodeName: string) => {
  const accessToken = JSON.parse(
    localStorage.getItem(`sb-${getSupabaseProjectId()}-auth-token`) || ''
  )?.access_token
  cy.task('insertCustomNode', {
    accessToken,
    nodeName,
  })
})

Cypress.Commands.add(
  'loginWithTestAccount',
  (email: string, password: string) => {
    cy.log('Logging in to supabase')
    cy.task('getSession', {
      email: email,
      password: password,
    }).then((_currentSession) => {
      // put session where supabase expects it
      const currentSession = _currentSession as Session
      localStorage.setItem(
        `sb-${getSupabaseProjectId()}-auth-token`,
        JSON.stringify(currentSession)
      )
      cy.log('Logged in to supabase')
    })
  }
)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      insertCustomNode(nodeName: string): Chainable<void>
      loginWithTestAccount(email: string, password: string): Chainable<void>
    }
  }
}
