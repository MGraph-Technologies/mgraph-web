describe('Custom detail editing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits a custom detail page, edits description, tests undo and redo, then undoes', () => {
    cy.visit('/mgraph')
    cy.get('[class*=CustomNode_header]').first().click()
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

    // undo
    cy.get('[id=undo-button]').click()
    cy.contains(newValue).should('not.exist')
  })

  it('Visits a custom detail page, edits description', () => {
    cy.visit('/mgraph')
    cy.get('[class*=CustomNode_header]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit field
    const newValue = Math.random().toString(36)
    cy.get('[id=description-field]').click()
    cy.get('[id=description-field]').clear().type(newValue)
    cy.get('[class*=Header]').first().click()
    cy.contains(newValue).should('exist')

    // test persistence
    cy.get('[id=done-button]').click()
    cy.wait(2000).reload()
    cy.contains(newValue).should('exist')
  })

  it('Visits a custom detail page, successfully mentions a user as owner, then sees the mention', () => {
    cy.visit('/mgraph')
    cy.get('[class*=CustomNode_header]').first().click()
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
    cy.get('[class*=Header]').first().click()

    // test persistence
    cy.get('[id=done-button]').click()
    cy.wait(2000).reload()
    cy.get('[class*=at_mention]')
      .contains('cypress-test-account')
      .should('exist')
  })

  it('Visits a metric detail page, enters working HTML via input parameter, then sees results', () => {
    cy.visit('/mgraph')
    cy.get('[class*=CustomNode_header]').first().click()
    cy.wait(2000)

    // set input parameter
    const currentTimeString = new Date().toISOString()
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=beginning_date-field]').click()
    cy.get('[id=beginning_date-field]')
      .clear()
      .type(`'${currentTimeString}'`)
      .parent()
      .click()
      .wait(1000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // edit html
    const randomString = Math.random().toString(36)
    const newHTML = `
      <div>${randomString}</div>
      <div>{{beginning_date}}</div>
    `
    cy.get('[id=source-html-field]').click()
    cy.get('[id=source-html-field]')
      .clear()
      .type(newHTML, { parseSpecialCharSequences: false })
    cy.get('[class*=Header]').first().click()

    // see results
    cy.wait(2000) // wait for iframe to load
    cy.get('[class*=NodeDetail_html_container]')
      .find('iframe')
      .then(($iframe) => {
        const $body = $iframe.contents().find('body')
        cy.wrap($body).contains(randomString)
        cy.wrap($body).contains(currentTimeString)
      })

    // test persistence
    cy.get('[id=done-button]').click()
    cy.wait(2000).reload()
    cy.wait(2000) // wait for iframe to load
    cy.get('[class*=NodeDetail_html_container]')
      .find('iframe')
      .then(($iframe) => {
        const $body = $iframe.contents().find('body')
        cy.wrap($body).contains(randomString)
        cy.wrap($body).contains(currentTimeString)
      })

    // reset input parameter
    cy.get('[id=query-settings-button]').click().wait(100)
    cy.get('[id=beginning_date-reset-button]').click().wait(100)
    cy.wait(2000) // wait for reset to process
  })
})

export {}
