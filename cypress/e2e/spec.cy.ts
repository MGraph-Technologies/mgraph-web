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
    cy.get('[class*=Header_account_menu_container]').click()
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
    cy.get('[class*=Header_account_menu_container]').click()
    cy.get('[class=p-menuitem]').contains('Access Management').click()
    cy.url().should('include', '/access-management')
  })

  it('Clicks through to database connections page', () => {
    cy.visit('/mgraph')
    cy.get('[class*=Header_account_menu_container]').click()
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
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
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
    cy.get('.react-flow__node-metric')
      .contains(newMetricName)
      .should('not.exist')

    // redo
    cy.get('[id=redo-button]').click()
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
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field').click()
    cy.get('textarea').clear().type(newValue).parent().click() // click outside of textarea to save
    cy.contains(newValue).should('exist')

    // undo
    cy.get('[id=undo-button]').click()
    cy.contains(newValue).should('not.exist')

    // redo
    cy.get('[id=redo-button]').click()
    cy.contains(newValue).should('exist')

    // cancel
    cy.get('[id=cancel-button]').click()
    cy.contains(newValue).should('not.exist')
  })

  it('Visits a metric detail page, edits description, then saves', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field').click()
    cy.get('textarea').clear().type(newValue).parent().click()
    cy.contains(newValue).should('exist')

    // save
    cy.get('[id=save-button]').click()
    cy.reload()
    cy.contains(newValue).should('exist')
  })

  it('Visits a metric detail page, enters a working query, then sees results', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()

    // edit query
    const randomInt = Math.floor(Math.random() * 1000000)
    const newQuery = "SELECT CURRENT_DATE, 'all', " + randomInt
    cy.get('[id=source-code-field').click()
    cy.get('textarea').clear().type(newQuery).parent().click()

    // see results
    cy.get('[class*=LineChart_chart_container]').trigger('mouseout') // make number overlay appear
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')
    // TODO: test chartjs canvas (this is just the number overlay)
  })

  it('Visits a metric detail page, enters a working query, saves it, then sees results', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()

    // edit query and save
    const randomInt = Math.floor(Math.random() * 1000000)
    const newQuery = "SELECT CURRENT_DATE, 'all', " + randomInt
    cy.get('[id=source-code-field').click()
    cy.get('textarea').clear().type(newQuery).parent().click()
    cy.get('[id=save-button]').click()

    // see results on metric detail page
    cy.reload()
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')

    // see results on metric graph page
    cy.visit('/mgraph')
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')
  })

  it('Visits a metric detail page, enters a failing query, then sees error', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()

    // edit query
    const newQuery = 'SELECT x'
    cy.get('[id=source-code-field').click()
    cy.get('textarea').clear().type(newQuery).parent().click()

    // see results
    cy.get('[class*=MetricDetail_chart_container]')
      .contains('invalid identifier')
      .should('exist')
  })

  it('Visits a metric detail page, enters a working but wrong-format query, then sees error', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()

    // edit query
    const newQuery = "SELECT TRUE, 'all', 1"
    cy.get('[id=source-code-field').click()
    cy.get('textarea').clear().type(newQuery).parent().click()

    // see results
    cy.get('[class*=MetricDetail_chart_container]')
      .contains('format')
      .should('exist')
  })

  // TODO: test processing and expired states

  it('Visits a metric detail page and tests persistence of query parameters', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()
    /* wait for page to load
     (otherwise the query settings menu will be closed on transition) */
    cy.wait(1000)

    // set group_by parameter
    const randomGroupBy = Math.random().toString(36)
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=group_by-field').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type("'" + randomGroupBy + "'")
      .parent()
      .click()

    // see that parameter persists
    cy.reload()
    cy.wait(1000) // wait for page to load
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=group_by-field').contains(randomGroupBy)

    // set parameter as default
    cy.get('[id=group_by-set-default-button]').click()

    // see that parameter persists as org default
    cy.reload()
    cy.wait(1000) // wait for page to load
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=group_by-field').contains(randomGroupBy)
    cy.get('[id=group_by-set-default-button]').should('not.exist')

    // set a new group_by parameter
    const randomGroupBy2 = Math.random().toString(36)
    cy.get('[id=group_by-field').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type("'" + randomGroupBy2 + "'")
      .parent()
      .click()

    // see that new parameter persists
    cy.reload()
    cy.wait(1000) // wait for page to load
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=group_by-field').contains(randomGroupBy2)

    // reset new parameter
    cy.get('[id=group_by-reset-button]').click()
    cy.wait(1000) // wait for reset to process

    // see that org default parameter appears
    cy.get('[id=group_by-field').contains(randomGroupBy)
    cy.get('[id=group_by-set-default-button]').should('not.exist')

    // see that default parameter persists
    cy.reload()
    cy.wait(1000) // wait for page to load
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=group_by-field').contains(randomGroupBy)
    cy.get('[id=group_by-set-default-button]').should('not.exist')
  })

  it('Visits a metric detail page, sets parameters, enters a query that uses them, then sees results', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(1000)
    cy.get('[id=link-to-detail-button]').first().click()
    /* wait for page to load
     (otherwise the query settings menu will be closed on transition) */
    cy.wait(1000)

    // set parameters
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=beginning_date-field').click()
    cy.get('[id=beginning_date-field]')
      .clear()
      .type("CURRENT_DATE - INTERVAL '90 DAY'")
      .parent()
      .click()
    cy.get('[id=ending_date-field').click()
    cy.get('[id=ending_date-field]')
      .clear()
      .type('CURRENT_DATE')
      .parent()
      .click()
    cy.get('[id=frequency-field').click()
    cy.get('[id=frequency-field]').clear().type('WEEK').parent().click()
    const randomGroupBy = Math.random().toString(36)
    cy.get('[id=group_by-field').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type("'" + randomGroupBy + "'")
      .parent()
      .click()
    cy.get('[id=query-settings-button]').click()

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit query
    const randomInt = Math.floor(Math.random() * 1000000)
    const newQuery = `
      SELECT
        DATE_TRUNC('{{frequency}}', {{beginning_date}}),
        {{group_by}},
        ${randomInt}
      
      UNION ALL
      SELECT
        DATE_TRUNC('{{frequency}}', {{ending_date}}),
        {{group_by}},
        ${randomInt}
    `
    cy.get('[id=source-code-field').click()
    cy.get('textarea')
      .clear()
      .type(newQuery, { parseSpecialCharSequences: false })
      .parent()
      .click()

    // see results
    cy.get('[class*=LineChart_chart_container]').trigger('mouseout') // make number overlay appear
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')
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
