describe('App landing page, unauthenticated', () => {
  it('Visits the app landing page', () => {
    cy.visit('/')
    cy.get('[alt="Sign in with Google"]').should('be.visible')
  })
})

describe('App landing page, authenticated as member of enabled org', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits the app landing page, is redirected to graphviewer, and sees full help menu', () => {
    cy.visit('/')
    cy.url().should('include', '/mgraph')
    cy.get('[id="help-menu"]').click()
    cy.get('[class=p-menuitem]').contains('Contact Us').should('be.visible')
    cy.get('[class=p-menuitem]').contains('Runbook').should('be.visible')
  })

  it('Visits the app landing page, logs out, and is redirected', () => {
    cy.visit('/')
    cy.get('[id=account-menu]').click()
    cy.get('[class=p-menuitem]').contains('Sign Out').click()
    cy.location('pathname').should('eq', '/')
  })

  it('Visits the app landing page, simulates visibility change, and does not see chart reloading/rerendering', () => {
    // visit page
    cy.visit('/')
    cy.wait(2000)

    // wait for loading to complete
    cy.get('[class*=progress_spinner_container]', { timeout: 30000 }).should(
      'not.exist'
    )

    // simulate visibility change
    cy.document().then((doc) => {
      cy.stub(doc, 'hidden').value(true)
    })
    cy.document().trigger('visibilitychange')
    cy.wait(1000)

    // check no loading spinners
    cy.get('[class*=progress_spinner_container]').should('have.length', 0)
  })
})

describe('App landing page, authenticated as member of disabled org', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL').replace(
        '@',
        '+organization_disabled@'
      ),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits the app landing page, is redirected to coming_soon, and sees help menu without runbook', () => {
    cy.visit('/')
    cy.url().should('include', '/coming-soon')
    cy.get('[id="help-menu"]').click()
    cy.get('[class=p-menuitem]').contains('Contact Us').should('be.visible')
    cy.get('[class=p-menuitem]').contains('Runbook').should('not.exist')
  })
})

export {}
