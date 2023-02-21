describe('Custom detail viewing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits and sees expected content on a custom detail page', () => {
    cy.visit('/mgraph')
    cy.get('[class*=CustomNode_header]').first().click()
    cy.get('body').contains('Description')
    cy.get('body').contains('Inputs')
    cy.get('body').contains('Outputs')
    // TODO: check population of inputs and outputs
    cy.get('body').contains('Owner')
    cy.get('body').contains('Source')
  })

  it('Views comments, then adds, edits, replies to, and deletes a comment', () => {
    cy.visit('/mgraph')
    cy.get('[class*=CustomNode_header]').first().click()
    cy.get('body').contains('Description')

    // view comments
    cy.get('[id*=comments-button]').first().click()

    // wait for comments to load
    cy.wait(2000)

    // add comment
    const randomString = Math.random().toString(36)
    cy.get('[id*=new-comment-field]').click().clear().type(randomString)
    cy.get('[id*=add-comment-button]').click()
    cy.contains('[class*=CommentsProvider_body]', randomString)

    // check that change has persisted
    cy.reload()
    cy.get('[id*=comments-button]').first().click()
    cy.contains('[class*=CommentsProvider_body]', randomString).scrollIntoView()

    // edit comment
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString)
      .parent()
      .find('[id*=begin-edit-comment]')
      .click()
    const randomString2 = Math.random().toString(36)
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString)
      .click()
      .clear()
      .type(randomString2)
    cy.get('[id*=save-edit-comment]').click()
    cy.contains('[class*=CommentsProvider_body]', randomString2)
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString2)
      .parent()
      .contains(' | edited')

    // check that change has persisted
    cy.reload()
    cy.get('[id*=comments-button]').first().click()
    cy.contains(
      '[class*=CommentsProvider_body]',
      randomString2
    ).scrollIntoView()

    // reply
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString2)
      .parent()
      .find('[id*=begin-reply-comment]')
      .click()
    const randomString3 = Math.random().toString(36)
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString2)
      .parent()
      .find('[id*=new-comment-field]')
      .click()
      .clear()
      .type(randomString3)
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString2)
      .parent()
      .find('[id*=add-comment-button]')
      .click()
    cy.contains('[class*=CommentsProvider_body]', randomString3)

    // check that change has persisted
    cy.reload()
    cy.get('[id*=comments-button]').first().click()
    cy.contains('[class*=CommentsProvider_body]', randomString2)
      .scrollIntoView()
      .parent()
      .find('[class*=CommentsProvider_expand_thread_container]')
      .click()
    cy.contains('[class*=CommentsProvider_body]', randomString3)

    // delete parent comment
    cy.get('[class*=CommentsProvider_body]')
      .contains(randomString2)
      .parent()
      .find('[id*=delete-comment]')
      .first()
      .click()
    cy.get('[class*=p-confirm-dialog-accept]').click()

    // check that change has persisted
    cy.reload()
    cy.get('[id*=comments-button]').first().click()
    cy.contains('[class*=CommentsProvider_body]', randomString2).should(
      'not.exist'
    )

    // wait for db
    cy.wait(2000)
  })
})

export {}
