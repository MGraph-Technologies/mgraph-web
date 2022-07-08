describe('App landing page', () => {
  it('Visits the app landing page', () => {
    cy.visit('/')
    cy.contains('Sign in')
  })
})
