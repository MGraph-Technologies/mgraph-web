describe('App landing page, unauthenticated', () => {
  it('Visits the app landing page', () => {
    cy.visit('/')
    cy.contains('Sign in')
  })
})

describe('App landing page, authenticated', () => {
  beforeEach(() => {
    cy.loginWithTestAccount()
  })

  it('Visits the app landing page and is redirected to org', () => {
    cy.visit('/')
    cy.url().should('include', '/mgraph')
  })
})

export {}
