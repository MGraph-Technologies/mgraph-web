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

Cypress.Commands.add(
  'loginWithTestAccount',
  (email: string, password: string) => {
    cy.log('Logging in to supabase')
    cy.task('getSupabaseSession', {
      email: email,
      password: password,
      supabaseUrl: Cypress.env('SUPABASE_URL'),
      supabaseAnonKey: Cypress.env('SUPABASE_ANON_KEY'),
    }).then((_currentSession) => {
      const currentSession = _currentSession as Session
      localStorage.setItem(
        'supabase.auth.token',
        JSON.stringify({
          currentSession,
          expiresAt: currentSession.expires_at,
        })
      )
    })
  }
)

declare global {
  namespace Cypress {
    interface Chainable {
      loginWithTestAccount(email: string, password: string): Chainable<void>
    }
  }
}
