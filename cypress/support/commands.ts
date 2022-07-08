// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

import { Session } from "@supabase/supabase-js";

Cypress.Commands.add('loginWithTestAccount', () => {
  cy.log('Logging in to supabase')
  cy.task('getSupabaseSession', {
    email: Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
    password: Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD'),
    supabaseUrl: Cypress.env('SUPABASE_URL'),
    supabaseAnonKey: Cypress.env('SUPABASE_ANON_KEY'),
  }).then((_currentSession) => {
    const currentSession = _currentSession as Session
    localStorage.setItem('supabase.auth.token', JSON.stringify({
      currentSession,
      expiresAt: currentSession.expires_at,
    }))
  })
})

declare global {
  namespace Cypress {
    interface Chainable {
      loginWithTestAccount(): Chainable<void>
    }
  }
}