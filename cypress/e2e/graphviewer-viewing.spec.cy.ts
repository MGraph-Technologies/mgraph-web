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

  // TODO: clicking function highlights connected nodes

  it('Sees edit button', () => {
    cy.visit('/mgraph')
    cy.get('[id=edit-button]').should('exist')
  })

  it('Clicks through to a metric detail page, and back', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.url().should('include', '/nodes/')
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
    cy.url().should('include', '/nodes/')
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

export {}
