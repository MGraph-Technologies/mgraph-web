describe('Metric detail viewing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits and sees expected content on a metric detail page', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.get('body').contains('Description')
    cy.get('body').contains('Inputs')
    cy.get('body').contains('Outputs')
    // TODO: check population of inputs and outputs
    cy.get('body').contains('Owner')
    cy.get('body').contains('Source')
  })

  it('Views comments, then adds and deletes a comment', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.wait(2000)

    // view comments
    cy.get('[id*=comments-button]').first().click()

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

export {}
