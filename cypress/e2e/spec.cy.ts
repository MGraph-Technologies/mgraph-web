describe('App landing page, unauthenticated', () => {
  it('Visits the app landing page', () => {
    cy.visit('/')
    cy.contains('Sign in')
  })
})

describe('App landing page, authenticated as member of enabled org', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits the app landing page and is redirected to graphviewer', () => {
    cy.visit('/')
    cy.url().should('include', '/mgraph')
  })

  it('Visits the app landing page, logs out, and is redirected', () => {
    cy.visit('/')
    cy.get('[id=account-menu-container]').click()
    cy.get('[class=p-menuitem]').contains('Sign Out').click()
    cy.location('pathname').should('eq', '/')
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

  it('Visits the app landing page and is redirected to coming_soon', () => {
    cy.visit('/')
    cy.url().should('include', '/coming-soon')
  })
})

describe('Graphviewer viewing as admin', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Zooms in, out, fit on the graphviewer', () => {
    cy.visit('/mgraph')
    cy.get('.react-flow__controls-zoomin').click()
    cy.get('.react-flow__controls-zoomout').click()
    cy.get('.react-flow__controls-fitview').click()
  })

  it('Sees metric node, function node, input edge on the graphviewer', () => {
    cy.visit('/mgraph')
    cy.get('.react-flow__node-metric').should('be.visible')
    cy.get('.react-flow__node-function').should('be.visible')
    cy.get('.react-flow__edge-input').should('be.visible')
  })

  it('Sees edit button', () => {
    cy.visit('/mgraph')
    cy.get('[id=edit-button]').should('exist')
  })

  it('Clicks through to a metric detail page, and back', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.url().should('include', '/metrics/')
    cy.get('[id=back-to-graphviewer-button]').click()
    cy.url().should('include', '/mgraph')
  })

  it('Clicks through to access management page', () => {
    cy.visit('/mgraph')
    cy.get('[id=account-menu-container]').click()
    cy.get('[class=p-menuitem]').contains('Access Management').click()
    cy.url().should('include', '/access-management')
  })

  it('Clicks through to database connections page', () => {
    cy.visit('/mgraph')
    cy.get('[id=account-menu-container]').click()
    cy.get('[class=p-menuitem]').contains('Database Connections').click()
    cy.url().should('include', '/database-connections')
  })
})

describe('Graphviewer viewing as viewer', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL').replace('@', '+viewer@'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Does not see edit button', () => {
    cy.visit('/mgraph')
    cy.get('[id=edit-button]').should('not.exist')
  })
})

describe('Graphviewer viewing as awaiting admin approval', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL').replace(
        '@',
        '+awaiting_admin_approval@'
      ),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits the app landing page and sees prompt to contact admin, not graphviewer', () => {
    cy.visit('/mgraph')
    cy.get('body').contains('contact your administrator')
    cy.get('.react-flow__controls-zoomin').should('not.exist')
  })
})

describe('Graphviewer editing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Adds a metric, tests undo and redo, adds a formula, then cancels additions', () => {
    cy.visit('/mgraph')
    cy.wait(1000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // add and rename metric
    const newMetricName = Math.random().toString(36)
    cy.get('[id=add-metric-button]').click()
    cy.get('.react-flow__controls-fitview').click()
    cy.get('.react-flow__node-metric').contains('New Metric').click()
    cy.get('input').clear().type(newMetricName).type('{enter}')
    cy.get('.react-flow__node-metric')
      .contains(newMetricName)
      .should('be.visible')

    // undo
    cy.get('[id=undo-button]').click()
    cy.wait(1000) // wait for rerender
    cy.get('.react-flow__node-metric')
      .contains(newMetricName)
      .should('not.exist')

    // redo
    cy.get('[id=redo-button]').click()
    cy.wait(1000)
    cy.get('.react-flow__node-metric')
      .contains(newMetricName)
      .should('be.visible')

    // add formula
    cy.get('[id=add-formula-button]').click()
    cy.get('[id=formula-field]')
      .click()
      .type(newMetricName)
      .wait(1000)
      .type('{enter}') // wait for suggestion to load
      .type('~')
      .wait(1000)
      .type('{enter}')
      .type('Active Users')
      .wait(1000)
      .type('{enter}')
    cy.get('[id=save-formula-button]').click()
    // TODO: check newly-added function node is visible
    // (requires distinguishing which function node is the new one)

    // cancel
    cy.get('[id=cancel-button]').click()
    cy.get('.react-flow__node-metric')
      .contains(newMetricName)
      .should('not.exist')
  })

  // TODO: add and save (was having trouble with deletion)
})

describe('Metric detail viewing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits and sees expected content on a metric detail page', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(1000) // wait for graph to render
    cy.get('body').contains('Description')
    cy.get('body').contains('Inputs')
    cy.get('body').contains('Outputs')
    // TODO: check population of inputs and outputs
    cy.get('body').contains('Owner')
    cy.get('body').contains('Source')
  })
})

describe('Metric detail editing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits a metric detail page, edits description, tests undo and redo, then cancels', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(1000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field').click()
    cy.get('textarea').clear().type(newValue).parent().click() // click outside of textarea to save
    cy.contains(newValue).should('exist')

    // undo
    cy.get('[id=undo-button]').click()
    cy.wait(1000)
    cy.contains(newValue).should('not.exist')

    // redo
    cy.get('[id=redo-button]').click()
    cy.wait(1000)
    cy.contains(newValue).should('exist')

    // cancel
    cy.get('[id=cancel-button]').click()
    cy.wait(1000) // wait for graph refresh
    cy.contains(newValue).should('not.exist')
  })

  it('Visits a metric detail page, edits description, then saves', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(1000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field').click()
    cy.get('textarea').clear().type(newValue).parent().click()
    cy.contains(newValue).should('exist')

    // save
    cy.get('[id=save-button]').click()
    cy.wait(1000)
    cy.contains(newValue).should('exist')
  })
})

describe('Admin settings', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits access management page and sees expected content', () => {
    cy.visit('/mgraph/settings/access-management')
    cy.get('body').contains('Add Users')
    cy.get('body').contains('Default role')
    cy.get('body').contains('Edit Users')
    cy.get('body').contains('Role')
    cy.get('body').contains('Email')
  })

  it('Visits database connections page and sees expected content', () => {
    cy.visit('/mgraph/settings/database-connections')
    cy.get('body').contains('please contact an MGraph team member')
  })
})

export {}
