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

  it('Visits input parameters page, edits then resets dimensions', () => {
    // visit page
    cy.visit('/mgraph/settings/input-parameters')

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

  it('Visits input parameters page, edits then resets frequencies', () => {
    // visit page
    cy.visit('/mgraph/settings/input-parameters')

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
