describe('Graphviewer editing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Adds a custom node, then cancels addition', () => {
    cy.visit('/mgraph')
    /* wait for graph to load before editing
    (otherwise, added nodes are overwritten by graph load) */
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // add and rename metric
    const newNodeName = Math.random().toString(36)
    cy.get('[id=add-node-button]').click()
    cy.get('[class*=p-listbox-item]').contains('Custom').click()
    cy.get('.react-flow__controls-fitview').click()
    cy.get('.react-flow__node-custom').contains('New Custom').click()
    cy.get('input').first().clear().type(newNodeName).type('{enter}')
    cy.get('.react-flow__node-custom')
      .contains(newNodeName)
      .should('be.visible')

    // cancel
    cy.get('[id=cancel-button]').click()
    cy.get('.react-flow__node-custom').contains(newNodeName).should('not.exist')
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
    cy.get('[id=add-node-button]').click()
    cy.get('[class*=p-listbox-item]').contains('Metric').click()
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
    cy.get('[id=add-relationship-button]').click()
    cy.get('[class*=p-listbox-item]').contains('Formula').click()
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

  it('Edits table view order', () => {
    cy.visit('/mgraph')

    // go to metric page
    cy.get('[class*=metric_node]').first().click()
    // wait for page to load
    cy.wait(2000)
    // get a metric id + name
    cy.url().then((url) => {
      const metricId = url.split('/').pop()
      cy.get('h1')
        .invoke('text')
        .then((metricName) => {
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

export {}
