describe('Metric detail editing', () => {
  beforeEach(() => {
    cy.loginWithTestAccount(
      Cypress.env('CYPRESS_TEST_ACCOUNT_EMAIL'),
      Cypress.env('CYPRESS_TEST_ACCOUNT_PASSWORD')
    )
  })

  it('Visits a metric detail page, edits description, tests undo and redo, then undoes', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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

  it('Visits a metric detail page, edits description, then saves', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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
    cy.get('[id=done-button]').click()
    cy.wait(2000).reload()
    cy.contains(newValue).should('exist')
  })

  it('Visits a metric detail page, successfully mentions a user as owner, then sees the mention', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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
    cy.get('[id=done-button]').click()
    cy.wait(2000)
    cy.get('[class*=at_mention]')
      .contains('cypress-test-account')
      .should('exist')
  })

  it('Visits a metric detail page, enters a working SQL query, then sees results and tests chart settings', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()

    // ensure dbt sync is off
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('None').first().click()

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

    // test yMin and yMax
    cy.get('[id=chart-yMin-field]').click().clear().type('0')
    cy.get('[id=chart-yMax-field]').click().clear().type('2000000')
    cy.get('[id=refresh-query-button]').first().click()
    cy.get('[class*=LineChart_chart_container]').trigger('mouseout') // make number overlay appear
    cy.get('[class*=LineChart_chart_container]')
      .contains(randomInt.toLocaleString())
      .should('exist')
    // TODO: test chartjs canvas (this is just the number overlay)

    // clear yMin and yMax
    cy.get('[id=chart-yMin-field-clear-button]').click()
    cy.get('[id=chart-yMax-field-clear-button]').click()
    cy.wait(2000)
  })

  it('Visits a metric detail page, enters a working SQL query, saves it, then sees results', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()

    // ensure dbt sync is off
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('None').first().click()

    // edit query and save
    const randomInt = Math.floor(Math.random() * 1000000)
    const newQuery = "SELECT CURRENT_DATE, 'all', " + randomInt
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]').clear().type(newQuery)
    cy.get('[class*=Header]').first().click()
    cy.get('[id=done-button]').click()

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
    cy.get('[class*=metric_node]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()

    // ensure dbt sync is off
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('None').first().click()

    // edit query
    const newQuery = 'SELECT x'
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]').clear().type(newQuery)
    cy.get('[id=refresh-query-button]').first().click()

    // see results
    cy.get('[class*=NodeDetail_chart_container]')
      .contains('invalid identifier')
      .should('exist')
  })

  it('Visits a metric detail page, enters a working but wrong-format SQL query using dbt connection and syntax, then sees error', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.wait(2000)

    // begin editing
    cy.get('[id=edit-button]').click()

    // select snowflake dbt proxy as source database connection
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake dbt proxy')
      .first()
      .click()

    // ensure dbt sync is off
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('None').first().click()

    // edit query
    const newQuery = "SELECT date FROM {{ ref('dim_dates') }} LIMIT 1"
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]')
      .clear()
      .type(newQuery, { parseSpecialCharSequences: false })
    cy.get('[id=refresh-query-button]').first().click()

    // see results
    cy.get('[class*=NodeDetail_chart_container]')
      .contains('format')
      .should('exist')
  })

  // TODO: test processing and expired states

  it('Visits a metric detail page, then adds, evals, edits, and deletes a couple goals', () => {
    // visit page
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
    cy.wait(2000)

    // set frequency to DAY, group by to null
    cy.get('[id=query-settings-button]').click()
    cy.get('[id=frequency-field]').click()
    cy.get('[id=frequency-field]')
      .clear()
      .type('DAY')
      .parent()
      .click()
      .wait(100)
    cy.get('[id=group_by-field]').click()
    cy.get('[id=group_by-field]')
      .clear()
      .type('NULL')
      .parent()
      .click()
      .wait(100)

    // add query to compare goals to
    cy.get('[id=edit-button]').click()
    cy.get('[id=source-database-connection-dropdown]').click()
    cy.get('[class*=p-dropdown-item]')
      .contains('snowflake direct')
      .first()
      .click()
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('None').first().click()
    const newQuery = `
      SELECT '2023-01-01'::date, NULL, 100
      UNION ALL
      SELECT '2023-02-01'::date, NULL, 200
      UNION ALL
      SELECT '2023-02-15'::date, NULL, 300
    `
    cy.get('[id=source-query-field]').click()
    cy.get('[id=source-query-field]').clear().type(newQuery)
    cy.get('[class*=Header]').first().click()
    cy.get('[id=done-button]').click()

    cy.wait(2000).reload()
    cy.get('[class*=LineChart_chart_container]').contains('300').should('exist')

    // add achieved goal
    const randomString = Math.random().toString(36)
    const newGoalName = 'test name ' + randomString
    cy.get('[id=edit-button]').click()
    cy.get('[id=new-goal-button]').click()
    cy.get('[id=goal-name-field]').type(newGoalName)
    cy.get('[id=goal-owner-field]').type('test owner')
    cy.get('[id=goal-description-field]').type('test description')
    cy.get('[id=goal-dimension-field]').type('{"name":null,"value":null}', {
      parseSpecialCharSequences: false,
    })
    cy.get('[id=goal-frequency-field]').type('DAY')
    cy.get('[id=goal-type-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('increase').first().click()
    cy.get('[id=goal-values-field]').type(
      '{"date":"2023-01-01","value":100},{"date":"2023-02-01","value":100}',
      { parseSpecialCharSequences: false }
    )
    cy.get('[id=save-goal-button]').click()

    // check change + evaluation
    cy.wait(2000)
    cy.reload()
    cy.get('[id=goals-table]')
      .contains(newGoalName)
      .parent('tr')
      .find('[class*=pi-check-circle]')
      .should('exist')

    // edit goal to just achieved
    cy.get('[id=edit-button]').click()
    cy.get('[id=goals-table]')
      .contains(newGoalName)
      .parent('tr')
      .find('[id=edit-goal-button]')
      .click()
    cy.get('[id=goal-values-field]')
      .clear()
      .type(
        '{"date":"2023-01-01","value":100},{"date":"2023-02-01","value":200}',
        { parseSpecialCharSequences: false }
      )
    cy.get('[id=save-goal-button]').click()

    // check change + evaluation
    cy.wait(2000)
    cy.reload()
    cy.get('[id=goals-table]')
      .contains(newGoalName)
      .parent('tr')
      .find('[class*=pi-check-circle]')

    // edit goal to not achieved
    cy.get('[id=edit-button]').click()
    cy.get('[id=goals-table]')
      .contains(newGoalName)
      .parent('tr')
      .find('[id=edit-goal-button]')
      .click()
    cy.get('[id=goal-values-field]')
      .clear()
      .type(
        '{"date":"2023-01-01","value":100},{"date":"2023-02-01","value":300}',
        { parseSpecialCharSequences: false }
      )
    cy.get('[id=save-goal-button]').click()

    // check change + evaluation
    cy.wait(2000)
    cy.reload()
    cy.get('[id=goals-table]')
      .contains(newGoalName)
      .parent('tr')
      .find('[class*=pi-times-circle]')
      .should('exist')

    // add on track in-progress goal
    cy.get('[id=edit-button]').click()
    cy.get('[id=new-goal-button]').click()
    cy.get('[id=goal-name-field]').type(newGoalName + '2')
    cy.get('[id=goal-owner-field]').type('test owner')
    cy.get('[id=goal-description-field]').type('test description')
    cy.get('[id=goal-dimension-field]').type('{"name":null,"value":null}', {
      parseSpecialCharSequences: false,
    })
    cy.get('[id=goal-frequency-field]').type('DAY')
    cy.get('[id=goal-type-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('increase').first().click()
    cy.get('[id=goal-values-field]').type(
      '{"date":"2023-02-01","value":200},{"date":"2023-03-01","value":300}',
      { parseSpecialCharSequences: false }
    )
    cy.get('[id=save-goal-button]').click()

    // check change + evaluation
    cy.wait(2000)
    cy.reload()
    cy.get('[id=goals-table]')
      .contains(newGoalName + '2')
      .parent('tr')
      .find('[class*=p-button-success]')
      .find('[class*=pi-circle]')
      .should('exist')

    // edit goal to be off track
    cy.get('[id=edit-button]').click()
    cy.get('[id=goals-table]')
      .contains(newGoalName + '2')
      .parent('tr')
      .find('[id=edit-goal-button]')
      .click()
    cy.get('[id=goal-values-field]')
      .clear()
      .type(
        '{"date":"2023-02-01","value":200},{"date":"2023-03-01","value":500}',
        { parseSpecialCharSequences: false }
      )
    cy.get('[id=save-goal-button]').click()

    // check change + evaluation
    cy.wait(2000) // no reload this time
    cy.get('[id=goals-table]')
      .contains(newGoalName + '2')
      .parent('tr')
      .find('[class*=p-button-warning]')
      .find('[class*=pi-circle]')
      .should('exist')

    // delete all goals
    cy.get('[id=delete-goal-button]').each(() => {
      // avoid dom detached error
      cy.get('[id=delete-goal-button]').first().click()
      cy.get('[class*=p-confirm-dialog-accept]').contains('Delete').click()
    })
  })

  it('Visits a metric detail page and tests dbt query generation', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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
    cy.get('[id=source-query-type-radio-group-generated]').click()
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

  it('Visits a metric detail page and tests persistence of input parameters via keyboard', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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

  it('Visits a metric detail page and tests persistence of input parameters via mouse', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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
    cy.get('li').contains('test_dimension').click().wait(1000)

    cy.get('[id=conditions-field]').click()
    cy.get('[id*=condition-dimension-picker]').click()
    cy.get('li').contains('test_dimension').click().wait(1000)
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
    cy.get('[id=group_by-field]').contains('test_dimension')
    cy.get('[id=frequency-field]').contains('MONTH')
    cy.get('[id=conditions-field]').contains('test_dimension')

    // reset all
    cy.get('[id*=reset-button]').each(() => {
      // avoid dom detached error
      cy.get('[id*=reset-button]').first().click().wait(1000)
    })
  })

  it('Visits a metric detail page, sets parameters, enters a SQL query that uses them, then sees results', () => {
    cy.visit('/mgraph')
    cy.get('[class*=metric_node]').first().click()
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

    // ensure dbt sync is off
    cy.get('[id=source-dbt-project-graph-sync-dropdown]').click()
    cy.get('[class*=p-dropdown-item]').contains('None').first().click()

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
    cy.get('[class*=metric_node]').first().click()
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
    cy.get('[id=input-parameter-overrides-field]').type(
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

    // delete all monitoring rules
    cy.get('[id=edit-button]').click()
    cy.get('[id=delete-monitoring-rule-button]').each(() => {
      // avoid dom detached error
      cy.get('[id=delete-monitoring-rule-button]').first().click()
      cy.get('[class*=p-confirm-dialog-accept]').contains('Delete').click()
    })
  })
})

export {}
