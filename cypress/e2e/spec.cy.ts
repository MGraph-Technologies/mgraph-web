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

  it('Clicks to and inspects table view', () => {
    cy.visit('/mgraph')
    cy.get('[class*=pi-table]').should('exist')
    cy.get('[class*=pi-sitemap]').should('exist')
    cy.get('[class*=pi-table]').click()
    cy.get('[id=query-settings-button]').should('exist')
    cy.contains('td', 'Metric')
    cy.get('td').find('[class*=GraphTable_chart_container]').should('exist')
    cy.get('td').find('[class*=pi-comment]').should('be.visible')
    cy.get('td').find('[class*=pi-info-circle]').should('be.visible')
    cy.get('td')
      .find('[id=link-to-detail-button]')
      .first()
      .click({ force: true })
    cy.url().should('include', '/metrics/')
    // reset to graphviewer, since toggle choice is sticky
    cy.visit('/mgraph')
    cy.get('[class*=pi-sitemap]').click()
  })

  it('Clicks through to access management page', () => {
    cy.visit('/mgraph')
    cy.get('[id=account-menu]').click()
    cy.get('[class=p-menuitem]').contains('Access Management').click()
    cy.url().should('include', '/access-management')
  })

  it('Clicks through to database connections page', () => {
    cy.visit('/mgraph')
    cy.get('[id=account-menu]').click()
    cy.get('[class=p-menuitem]').contains('Database Connections').click()
    cy.url().should('include', '/database-connections')
  })

  it('Clicks through to database connections page', () => {
    cy.visit('/mgraph')
    cy.get('[id=account-menu]').click()
    cy.get('[class=p-menuitem]').contains('Graph Syncs').click()
    cy.url().should('include', '/graph-syncs')
  })

  it('Clicks through to refresh jobs page', () => {
    cy.visit('/mgraph')
    cy.get('[id=account-menu]').click()
    cy.get('[class=p-menuitem]').contains('Refresh Jobs').click()
    cy.url().should('include', '/refresh-jobs')
  })

  it('Views comments, then adds and deletes a comment', () => {
    cy.visit('/mgraph')
    // view comments
    cy.get('[id=comments-button]').first().click()

    // add comment
    const randomString = Math.random().toString(36)
    cy.get('[class*=module_editor]').first().click().clear().type(randomString)
    cy.get('[class*=sbui-btn').contains('Submit').click()
    cy.contains('[class*=sce-comment-body]', randomString)

    // edit comment
    cy.get('[class*=sce-comment-body]')
      .get('[class*=sbui-dropdown__trigger')
      .first()
      .click()
    cy.get('[class*=sbui-dropdown-item]').contains('Edit').click()
    const randomString2 = Math.random().toString(36)
    cy.get('[class*=sce-comment-body]')
      .get('[class*=module_editor]')
      .first()
      .click()
      .clear()
      .type(randomString2)
    cy.get('[class*=sbui-btn').contains('Save').click()
    cy.contains('[class*=sce-comment-body]', randomString2)

    // delete comment
    cy.get('[class*=sce-comment-body]')
      .get('[class*=sbui-dropdown__trigger')
      .first()
      .click({ force: true })
    cy.get('[class*=sbui-dropdown-item]')
      .contains('Delete')
      .click({ force: true })
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
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // add and rename metric
    const newMetricName = Math.random().toString(36)
    cy.get('[id=add-metric-button]').click()
    cy.get('.react-flow__controls-fitview').click()
    cy.get('.react-flow__node-metric').contains('New Metric').click()
    cy.get('input').first().clear().type(newMetricName).type('{enter}')
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
      .wait(2000)
      .type('{enter}') // wait for suggestion to load
      .type('~')
      .wait(2000)
      .type('{enter}')
      .type('Active Users')
      .wait(2000)
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

  it('Adds mission, connects it with a formula, then cancels addition', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // add and rename mission
    const newMission = Math.random().toString(36)
    cy.get('[id=add-mission-toggle]').click().click() // reset toggle
    cy.get('.react-flow__controls-fitview').click()
    cy.get('.react-flow__node-mission').click()
    cy.get('textarea').clear().type(newMission).type('{enter}')
    cy.get('.react-flow__node-mission')
      .contains(newMission)
      .should('be.visible')

    // add formula
    cy.get('[id=add-formula-button]').click()
    cy.get('[id=formula-field]')
      .click()
      .type('mission')
      .wait(2000)
      .type('{enter}') // wait for suggestion to load
      .type('f')
      .wait(2000)
      .type('{enter}')
      .type('Active Users')
      .wait(2000)
      .type('{enter}')
    cy.get('[id=save-formula-button]').click()
  })

  it('Edits table view order', () => {
    cy.visit('/mgraph')

    // go to metric page
    cy.get('[id=link-to-detail-button]').first().click()
    // wait for page to load
    cy.get('[id=name-field]').contains(/^Metric: .+/)
    // get a metric id + name
    cy.url().then((url) => {
      const metricId = url.split('/').pop()
      cy.get('[id=name-field]')
        .invoke('text')
        .then((text) => {
          const metricName = text.split(': ').pop() // remove 'Metric: ' prefix
          cy.log(`metricId: ${metricId}`)
          cy.log(`metricName: ${metricName}`)

          // go back to graph
          cy.visit('/mgraph')

          // go to table view
          cy.get('[class*=pi-table]').click()

          // wait for table to load
          cy.get('[class*=pi-info-circle]').should('be.visible')

          // edit top-level metrics
          cy.get('[id=edit-button]').click()
          cy.get('[id=table-position-field]')
            .click()
            .clear()
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .type(metricId!)
          cy.get('[class*=Header]').first().click() // click outside of field to save

          // check that metric is now at top of table
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          cy.get('td').contains(metricName!).should('be.visible')

          // check that only metric is in table's top level
          cy.get('tr').should('have.length', 1)
        })
    })
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

  it('Views comments, then adds and deletes a comment', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // view comments
    cy.get('[id=comments-button]').first().click()

    // add comment
    const randomString = Math.random().toString(36)
    cy.get('[class*=module_editor]').first().click().clear().type(randomString)
    cy.get('[class*=sbui-btn').contains('Submit').click()
    cy.contains('[class*=sce-comment-body]', randomString)

    // edit comment
    cy.get('[class*=sce-comment-body]')
      .get('[class*=sbui-dropdown__trigger')
      .first()
      .click()
    cy.get('[class*=sbui-dropdown-item]').contains('Edit').click()
    const randomString2 = Math.random().toString(36)
    cy.get('[class*=sce-comment-body]')
      .get('[class*=module_editor]')
      .first()
      .click()
      .clear()
      .type(randomString2)
    cy.get('[class*=sbui-btn').contains('Save').click()
    cy.contains('[class*=sce-comment-body]', randomString2)

    // delete comment
    cy.get('[class*=sce-comment-body]')
      .get('[class*=sbui-dropdown__trigger')
      .first()
      .click({ force: true })
    cy.get('[class*=sbui-dropdown-item]')
      .contains('Delete')
      .click({ force: true })
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
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field]').click()
    cy.get('[id=description-field]').clear().type(newValue)
    cy.get('[class*=Header]').first().click() // click outside of textarea to save
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
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field]').click()
    cy.get('[id=description-field]').clear().type(newValue)
    cy.get('[class*=Header]').first().click()
    cy.contains(newValue).should('exist')

    // save
    cy.get('[id=save-button]').click()
    cy.wait(2000).reload()
    cy.contains(newValue).should('exist')
  })

  it('Visits a metric detail page, successfully mentions a user as owner, then sees the mention', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // mention user
    cy.get('[id=owner-field]').click().clear()
    cy.get('[id=owner-field]').type('@cypress-test-account')
    cy.get('[class*=p-mention-item]')
      .contains('cypress-test-account')
      .first()
      .click()

    // save
    cy.get('[id=save-button]').click()
    cy.wait(2000)
    cy.get('[class*=at_mention]')
      .contains('cypress-test-account')
      .should('exist')
  })

  it('Visits a metric detail page, enters a working SQL query, then sees results', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()

    // edit query
    const randomInt = Math.floor(Math.random() * 1000000)
    const newQuery = "SELECT CURRENT_DATE, 'all', " + randomInt
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]').clear().type(newQuery)
    cy.get('[id=refresh-query-button]').first().click()

    // see results
    cy.get('[class*=LineChart_chart_container]').trigger('mouseout') // make number overlay appear
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')
    // TODO: test chartjs canvas (this is just the number overlay)
  })

  it('Visits a metric detail page, enters a working SQL query, saves it, then sees results', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()

    // edit query and save
    const randomInt = Math.floor(Math.random() * 1000000)
    const newQuery = "SELECT CURRENT_DATE, 'all', " + randomInt
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]').clear().type(newQuery)
    cy.get('[class*=Header]').first().click()
    cy.get('[id=save-button]').click()

    // see results on metric detail page
    cy.wait(2000).reload()
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')

    // see results on metric graph page
    cy.visit('/mgraph')
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')
  })

  it('Visits a metric detail page, enters a failing SQL query, then sees error', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()

    // edit query
    const newQuery = 'SELECT x'
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]').clear().type(newQuery)
    cy.get('[id=refresh-query-button]').first().click()

    // see results
    cy.get('[class*=MetricDetail_chart_container]')
      .contains('invalid identifier')
      .should('exist')
  })

  it('Visits a metric detail page, enters a working but wrong-format SQL query using dbt connection and syntax, then sees error', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake dbt proxy as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake dbt proxy')
      .first()
      .click()

    // edit query
    const newQuery = "SELECT date FROM {{ ref('dim_dates') }} LIMIT 1"
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]')
      .clear()
      .type(newQuery, { parseSpecialCharSequences: false })
    cy.get('[id=refresh-query-button]').first().click()

    // see results
    cy.get('[class*=MetricDetail_chart_container]')
      .contains('format')
      .should('exist')
  })

  // TODO: test processing and expired states

  it('Visits a metric detail page and tests dbt query generation', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake dbt proxy as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake dbt proxy')
      .first()
      .click()

    // select dbt graph sync
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').not(':contains("none")').first().click()

    // enter working path
    cy.get('[id=source-dbt-project-path-field]')
      .click()
      .clear()
      .type('models/marts/schema.yml:daily_active_users')
    cy.get('[class*=Header]').first().click()

    // see populated yaml
    cy.get('body')
      .contains('calculation_method: count_distinct')
      .should('exist')

    // test query generation
    cy.get('[id=source-query-type-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('generated').first().click()
    cy.get('body').contains('metrics.calculate(').should('exist')

    // enter incorrect path
    cy.get('[id=source-dbt-project-path-field]')
      .click()
      .clear()
      .type('x')
      .parent()
      .click()
    cy.get('[class*=Header]').first().click() // click outside of field to save

    // see error
    cy.get('body').contains('metric not found').should('exist')
  })

  it('Visits a metric detail page and tests persistence of query parameters via keyboard', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    /* wait for page to load
     (otherwise the query settings menu will be closed on transition) */
    cy.wait(2000)

    // set parameters
    cy.get('[id=query-settings-button]').click().wait(100)

    const randomBeginningDate = Math.random().toString(36)
    cy.get('[id=beginning_date-field]').click()
    cy.get('[id=beginning_date-field]')
      .clear()
      .type("'" + randomBeginningDate + "'")
      .parent()
      .click()
      .wait(100)

    const randomEndingDate = Math.random().toString(36)
    cy.get('[id=ending_date-field]').click()
    cy.get('[id=ending_date-field]')
      .clear()
      .type("'" + randomEndingDate + "'")
      .parent()
      .click()
      .wait(100)

    const randomFrequency = Math.random().toString(36)
    cy.get('[id=frequency-field]').click()
    cy.get('[id=frequency-field]')
      .clear()
      .type("'" + randomFrequency + "'")
      .parent()
      .click()
      .wait(100)

    const randomGroupBy = Math.random().toString(36)
    cy.get('[id=group_by-field]').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type("'" + randomGroupBy + "'")
      .parent()
      .click()
      .wait(100)

    const randomConditions = Math.random().toString(36)
    cy.get('[id=conditions-field]').click()
    cy.get('[id=conditions-field]')
      .clear()
      .type("'" + randomConditions + "'")
      .parent()
      .click()
      .wait(100)

    // see that parameters persist
    cy.wait(2000).reload()
    cy.wait(2000) // wait for page to load
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=beginning_date-field]').contains(randomBeginningDate)
    cy.get('[id=ending_date-field]').contains(randomEndingDate)
    cy.get('[id=group_by-field]').contains(randomGroupBy)
    cy.get('[id=frequency-field]').contains(randomFrequency)
    cy.get('[id=conditions-field]').contains(randomConditions)

    // set parameter as default
    cy.get('[id=group_by-set-default-button]').click()

    // see that parameter persists as org default
    cy.wait(2000).reload()
    cy.wait(2000) // wait for page to load
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=group_by-field]').contains(randomGroupBy)
    cy.get('[id=group_by-set-default-button]').should('not.exist')

    // set a new group_by parameter
    const randomGroupBy2 = Math.random().toString(36)
    cy.get('[id=group_by-field]').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type("'" + randomGroupBy2 + "'")
      .parent()
      .click()

    // see that new parameter persists
    cy.wait(2000).reload()
    cy.wait(2000) // wait for page to load
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=group_by-field]').contains(randomGroupBy2)

    // reset new parameter
    cy.get('[id=group_by-reset-button]').click()
    cy.wait(2000) // wait for reset to process

    // see that org default parameter appears
    cy.get('[id=group_by-field]').contains(randomGroupBy)
    cy.get('[id=group_by-set-default-button]').should('not.exist')

    // see that default parameter persists
    cy.wait(2000).reload()
    cy.wait(2000) // wait for page to load
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=group_by-field]').contains(randomGroupBy)
    cy.get('[id=group_by-set-default-button]').should('not.exist')

    // reset other default parameters
    cy.get('[id=beginning_date-reset-button]').click().wait(100)
    cy.get('[id=ending_date-reset-button]').click().wait(100)
    cy.get('[id=frequency-reset-button]').click().wait(100)
    cy.get('[id=conditions-reset-button]').click().wait(100)
    cy.wait(2000) // wait for reset to process
  })

  it('Visits a metric detail page and tests persistence of query parameters via mouse', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    /* wait for page to load
     (otherwise the query settings menu will be closed on transition) */
    cy.wait(2000)

    // set parameters
    cy.get('[id=query-settings-button]').click().wait(100)

    cy.get('[id=beginning_date-field]').click()
    cy.get('[id=beginning_date-field]')
      .clear()
      .type("'2022-01-01'")
      .parent()
      .click()
      .wait(1000)
    cy.get('[id=beginning_date-field]').click()
    cy.get('[class*=p-datepicker-calendar]').contains('10').click().wait(1000)

    cy.get('[id=ending_date-field]').click()
    cy.get('[id=ending_date-field]')
      .click()
      .clear()
      .type("'2022-01-01'")
      .parent()
      .click()
      .wait(1000)
    cy.get('[id=ending_date-field]').click()
    cy.get('[class*=p-datepicker-calendar]').contains('12').click().wait(1000)

    cy.get('[id=frequency-field]').click()
    cy.get('li').contains('MONTH').click().wait(1000)

    cy.get('[id=group_by-field]').click()
    cy.get('li').contains('test').click().wait(1000)

    cy.get('[id=conditions-field]').click()
    cy.get('[id*=condition-dimension-picker]').click()
    cy.get('li').contains('test').click().wait(1000)
    cy.get('[id*=condition-operator-picker]').click()
    cy.get('li').contains('=').click().wait(1000)
    cy.get('[id*=condition-value-field]')
      .click()
      .clear()
      .type("'test'")
      .wait(1000)
    cy.get('[id*=condition-add-button]').click().wait(1000)

    // see that parameters persist
    cy.wait(2000).reload()
    cy.wait(2000) // wait for page to load
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=beginning_date-field]').contains('2022-01-10')
    cy.get('[id=ending_date-field]').contains('2022-01-12')
    cy.get('[id=group_by-field]').contains('test')
    cy.get('[id=frequency-field]').contains('MONTH')
    cy.get('[id=conditions-field]').contains('test')

    // reset all
    cy.get('[id*=reset-button]').each(() => {
      // avoid dom detached error
      cy.get('[id*=reset-button]').first().click().wait(1000)
    })
  })

  it('Visits a metric detail page, sets parameters, enters a SQL query that uses them, then sees results', () => {
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    /* wait for page to load
     (otherwise the query settings menu will be closed on transition) */
    cy.wait(2000)

    // set parameters
    cy.get('[id=query-settings-button]').click().wait(100)

    cy.get('[id=beginning_date-field]').click()
    cy.get('[id=beginning_date-field]')
      .clear()
      .type("CURRENT_DATE - INTERVAL '90 DAY'")
      .parent()
      .click()
      .wait(100)

    cy.get('[id=ending_date-field]').click()
    cy.get('[id=ending_date-field]')
      .clear()
      .type('CURRENT_DATE')
      .parent()
      .click()
      .wait(100)

    cy.get('[id=frequency-field]').click()
    cy.get('[id=frequency-field]')
      .clear()
      .type('WEEK')
      .parent()
      .click()
      .wait(100)

    const randomGroupBy = Math.random().toString(36)
    cy.get('[id=group_by-field]').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type("'" + randomGroupBy + "'")
      .parent()
      .click()
      .wait(100)

    cy.get('[id=query-settings-button]').click().wait(100)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('snowflake').first().click()

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
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]')
      .clear()
      .type(newQuery, { parseSpecialCharSequences: false })
    cy.get('[id=refresh-query-button]').first().click()

    // see results
    cy.get('[class*=LineChart_chart_container]').trigger('mouseout') // make number overlay appear
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')

    // reset parameters
    cy.reload()
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id*=reset-button]').each(() => {
      // avoid dom detached error
      cy.get('[id*=reset-button]').first().click().wait(1000)
    })
  })

  it('Visits a metric detail page, then adds, edits, and deletes a monitoring rule', () => {
    // visit page
    cy.visit('/mgraph')
    cy.get('[id=link-to-detail-button]').first().click()
    cy.wait(2000)

    // add monitoring rule
    const randomString = Math.random().toString(36)
    const newRuleSlackTo = '#' + randomString
    const newRuleName = 'test name ' + randomString
    cy.get('[id=edit-button]').click()
    cy.get('[id=new-monitoring-rule-button]').click()
    cy.get('[id=rule-name-field]').type(newRuleName)
    cy.get('[id=range-lower-bound-field]').type('-Infinity')
    cy.get('[id=range-upper-bound-field]').type('0.0')
    cy.get('[id=lookback-periods-field]').type('1')
    cy.get('[id=query-parameter-overrides-field]').type(
      'frequency:DAY,conditions:FALSE'
    )
    cy.get('[id=schedule-field]').type('0 13 * * *')
    cy.get('[id=slack-to-field]').type(newRuleSlackTo)
    cy.get('[id=save-monitoring-rule-button]').click()

    // TODO: check validation errors
    // TODO: test that rule actually works

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=monitoring-rules-table]')
      .contains(newRuleName)
      .parent('tr')
      .within(() => {
        cy.get('td').contains('0 13 * * *').should('exist')
        cy.get('td').contains(newRuleSlackTo).should('exist')
      })
    cy.get('[id*=monitoring-status-indicator]').should('exist')

    // edit rule
    cy.get('[id=edit-button]').click()
    cy.get('[id=monitoring-rules-table]')
      .contains(newRuleName)
      .parent('tr')
      .find('[id=edit-monitoring-rule-button]')
      .click()
    cy.get('[id=schedule-field]').clear().type('0 14 * * *')
    cy.get('[id=save-monitoring-rule-button]').click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=monitoring-rules-table]')
      .contains(newRuleName)
      .parent('tr')
      .within(() => {
        cy.get('td').contains('0 14 * * *').should('exist')
      })

    // delete rule
    cy.get('[id=edit-button]').click()
    cy.get('[id=monitoring-rules-table]')
      .contains(newRuleName)
      .parent('tr')
      .find('[id=delete-monitoring-rule-button]')
      .click()
    cy.get('[class*=p-confirm-dialog-accept]').contains('Delete').click()
    cy.get('[id=monitoring-rules-table]')
      .contains(newRuleSlackTo)
      .should('not.exist')
  })
})

describe('Admin settings', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it("Visits access management page, sees expected content, then toggles a user's role", () => {
    // visit access management page
    cy.visit('/mgraph/settings/access-management')

    // see expected content
    cy.get('body').contains('Add Users')
    cy.get('body').contains('Default role')
    cy.get('body').contains('Edit Users')
    cy.get('body').contains('Role')
    cy.get('body').contains('Email')

    // toggle a user's role
    cy.get('[id=users-table]')
      .contains('cypress-test-account+awaiting_admin_approval@mgraph.us')
      .parent('tr')
      .find('[class*=p-dropdown-trigger]')
      .first()
      .click()
    cy.get('[class*=p-dropdown-item]').contains('viewer').click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=users-table]')
      .contains('cypress-test-account+awaiting_admin_approval@mgraph.us')
      .parent('tr')
      .contains('viewer')

    // set it back
    cy.get('[id=users-table]')
      .contains('cypress-test-account+awaiting_admin_approval@mgraph.us')
      .parent('tr')
      .find('[class*=p-dropdown-trigger]')
      .first()
      .click()
    cy.get('[class*=p-dropdown-item]')
      .contains('awaiting_admin_approval')
      .click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=users-table]')
      .contains('cypress-test-account+awaiting_admin_approval@mgraph.us')
      .parent('tr')
      .contains('awaiting_admin_approval')
  })

  it('Visits database connections page, then adds, edits, and deletes a connection', () => {
    // visit page
    cy.visit('/mgraph/settings/database-connections')

    // add connection
    const randomString = Math.random().toString(36)
    cy.get('[id=new-database-connection-button]').click()
    cy.get('[id=name-field]').type(randomString)
    cy.get('[id=region-field]').type(randomString)
    cy.get('[id=account-field]').type(randomString)
    cy.get('[id=username-field]').type(randomString)
    cy.get('[id=password-field]').type(randomString)
    cy.get('[id=save-database-connection-button]').click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=database-connections-table]').contains(randomString)

    // TODO: test that connection works

    // edit connection
    const newRandomString = Math.random().toString(36)
    cy.get('[id=database-connections-table]')
      .contains(randomString)
      .parent('tr')
      .find('[id=edit-database-connection-button]')
      .click()
    cy.get('[id=name-field]').type(newRandomString)
    cy.get('[id=region-field]').type(newRandomString)
    cy.get('[id=account-field]').type(newRandomString)
    cy.get('[id=username-field]').type(newRandomString)
    cy.get('[id=password-field]').type(newRandomString)

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=database-connections-table]').contains(randomString)

    // delete connection
    cy.get('[id=database-connections-table]')
      .contains(randomString)
      .parent('tr')
      .find('[id=delete-database-connection-button]')
      .click()
    cy.get('[class*=p-confirm-dialog-accept]').contains('Delete').click()
    cy.get('[id=database-connections-table]')
      .contains(randomString)
      .should('not.exist')
  })

  it('Visits graph syncs page, sees expected content, tests partial installation flow, then edits a sync', () => {
    // visit page
    cy.visit('/mgraph/settings/graph-syncs')

    // see expected content
    cy.get('body').contains('Graph Syncs')

    // test partial installation flow
    const randomString = Math.random().toString(36)
    cy.get('[id=new-graph-sync-button]').click()
    cy.get('body').contains('New Graph Sync')
    cy.get('[id=name-field]').clear().type(randomString)
    cy.get('[id=github-repo-url-field]').clear().type(randomString)
    cy.get('[id=github-app-button').click()
    cy.url().should('include', 'mgraph-dbt-sync')
    // TODO: test full installation flow

    // edit graph sync
    cy.visit('/mgraph/settings/graph-syncs')
    cy.get('[id=graph-syncs-table]')
      .contains('dbt Project')
      .parent('tr')
      .find('[id=edit-graph-sync-button]')
      .click()
    cy.get('[id=name-field]').clear().type(randomString)
    cy.get('[id=save-graph-sync-button]').click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=graph-syncs-table]').contains(randomString)
  })

  it('Visits query parameters page, edits then resets dimensions', () => {
    // visit page
    cy.visit('/mgraph/settings/query-parameters')

    // add dimension
    const randomString = 'randomDimension_' + Math.random().toString(36)
    cy.get('[id=dimensions-field-edit-button]').click().wait(1000)
    cy.get('[id=dimensions-field]').clear().type(randomString).parent().click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=dimensions-field]').contains(randomString)

    // reset
    const resetString = 'NULL,test_dimension'
    cy.get('[id=dimensions-field-edit-button]').click().wait(1000)
    cy.get('[id=dimensions-field]').clear().type(resetString).parent().click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=dimensions-field]').contains(resetString)
  })

  it('Visits query parameters page, edits then resets frequencies', () => {
    // visit page
    cy.visit('/mgraph/settings/query-parameters')

    // add frequency
    const randomString = 'randomFrequency_' + Math.random().toString(36)
    cy.get('[id=frequencies-field-edit-button]').click().wait(1000)
    cy.get('[id=frequencies-field]').clear().type(randomString).parent().click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=frequencies-field]').contains(randomString)

    // reset
    const resetString = 'SECOND,MINUTE,HOUR,DAY,WEEK,MONTH,QUARTER,YEAR'
    cy.get('[id=frequencies-field-edit-button]').click().wait(1000)
    cy.get('[id=frequencies-field]').clear().type(resetString).parent().click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=frequencies-field]').contains(resetString)
  })

  it('Visits refresh jobs page, then adds, edits, and deletes a job', () => {
    // visit page
    cy.visit('/mgraph/settings/refresh-jobs')

    // add job
    const randomString = Math.random().toString(36)
    const newJobSlackTo = '#' + randomString
    cy.get('[id=new-refresh-job-button]').click()
    cy.get('[id=schedule-field]').type('0 13 * * *')
    cy.get('[id=slack-to-field]').type(newJobSlackTo)
    cy.get('[id=save-refresh-job-button]').click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=refresh-jobs-table]')
      .contains(newJobSlackTo)
      .parent('tr')
      .within(() => {
        cy.get('td').contains('0 13 * * *').should('exist')
        cy.get('td').contains(newJobSlackTo).should('exist')
      })

    // edit job
    cy.get('[id=refresh-jobs-table]')
      .contains(newJobSlackTo)
      .parent('tr')
      .find('[id=edit-refresh-job-button]')
      .click()
    cy.get('[id=schedule-field]').clear().type('0 14 * * *')
    cy.get('[id=save-refresh-job-button]').click()

    // check change has persisted
    cy.wait(2000)
    cy.reload()
    cy.get('[id=refresh-jobs-table]')
      .contains(newJobSlackTo)
      .parent('tr')
      .within(() => {
        cy.get('td').contains('0 14 * * *').should('exist')
      })

    // delete job
    cy.get('[id=refresh-jobs-table]')
      .contains(newJobSlackTo)
      .parent('tr')
      .find('[id=delete-refresh-job-button]')
      .click()
    cy.get('[class*=p-confirm-dialog-accept]').contains('Delete').click()
    cy.get('[id=refresh-jobs-table]')
      .contains(newJobSlackTo)
      .should('not.exist')
  })
})

export {}
