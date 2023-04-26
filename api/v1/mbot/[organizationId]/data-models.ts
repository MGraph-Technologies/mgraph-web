import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { SENTRY_CONFIG } from '../../../../sentry.server.config.js'
import { getBaseUrl } from '../../../../utils/appBaseUrl'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/mbot/[organizationId]/data-model...')
  const accessToken = (req.headers['supabase-access-token'] as string) || ''
  const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })

  const { organizationId } = req.query
  console.log('organizationId: ', organizationId)

  const method = req.method
  if (method === 'GET') {
    try {
      // get organization's mbot scopes
      const {
        data: organizationsData,
        error: organizationsError,
        status: organizationsStatus,
      } = await supabase
        .from('organizations')
        .select('mbot_scopes')
        .eq('id', organizationId)
        .is('deleted_at', null)
        .single()
      if (organizationsError && organizationsStatus !== 406) {
        throw organizationsError
      }
      if (!organizationsData) {
        throw new Error('No organizations found')
      }
      type MBotScopes = {
        [databaseConnectionId: string]: string[]
      }
      const organizations = organizationsData as {
        mbot_scopes: MBotScopes
      }
      const mbotScopes = organizations.mbot_scopes
      console.log('mbotScopes: ', mbotScopes)

      // form data model
      // (NB: this only works for snowflake; will need to update when we add other database types)
      type DataModelTables = {
        [tableId: string]: { [columnName: string]: string }
      }
      type DataModel = {
        databaseConnectionId: string
        tables: DataModelTables
      }
      const dataModels: DataModel[] = []
      for (const [databaseConnectionId, scopes] of Object.entries(mbotScopes)) {
        const executeQuery = async (statement: string) => {
          const queryResp = await fetch(
            getBaseUrl() + '/api/v1/database-queries',
            {
              method: 'POST',
              headers: {
                'supabase-access-token': accessToken,
              },
              body: JSON.stringify({
                databaseConnectionId,
                parentNodeId: null,
                statement,
              }),
            }
          )
          const queryData = await queryResp.json()
          if (queryData.error) {
            throw new Error(queryData.error)
          }
          return queryData.queryId
        }
        const getQueryResults = async (queryId: string) => {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const queryResultsResp = await fetch(
              getBaseUrl() + '/api/v1/database-queries/' + queryId + '/results',
              {
                method: 'GET',
                headers: {
                  'supabase-access-token': accessToken,
                },
              }
            )
            if (queryResultsResp.status === 202) {
              await new Promise((resolve) => setTimeout(resolve, 1000))
              continue
            } else if (queryResultsResp.status === 200) {
              const queryResultsData = await queryResultsResp.json()
              if (queryResultsData.error) {
                throw new Error(queryResultsData.error)
              }
              return queryResultsData
            } else {
              throw new Error(
                'Unexpected status code: ' + queryResultsResp.status
              )
            }
          }
        }

        // parse initially-provided database, schema, and table ids
        const initialDatabaseIds = scopes.filter((scope) => {
          return !scope.includes('.')
        })
        const initialSchemaIds = scopes.filter((scope) => {
          return scope.split('.').length === 2
        })
        const initialTableIds = scopes.filter((scope) => {
          return scope.split('.').length === 3
        })

        // expand databases into schemas
        // query for schemaIds
        const schemaIds = new Set<string>(initialSchemaIds)
        let schemaIdsQuery = ''
        initialDatabaseIds.forEach((databaseId, index) => {
          if (index > 0) {
            schemaIdsQuery += ' UNION ALL '
          }
          schemaIdsQuery += `
            SELECT catalog_name, schema_name 
            FROM ${databaseId}.information_schema.schemata
            WHERE schema_name != 'INFORMATION_SCHEMA'
          `
        })
        console.log('schemaIdsQuery: ', schemaIdsQuery)
        const schemaIdsQueryId = await executeQuery(schemaIdsQuery)
        console.log('schemaIdsQueryId: ', schemaIdsQueryId)
        // get schemaIds once query is complete
        const schemaIdsQueryResultsData = await getQueryResults(
          schemaIdsQueryId
        )
        schemaIdsQueryResultsData.rows.forEach((row: string[]) => {
          schemaIds.add(row[0] + '.' + row[1])
        })
        console.log('schemaIds: ', schemaIds)

        // expand schemas into tables
        // query for tableIds
        const tableIds = new Set<string>(initialTableIds)
        let tableIdsQuery = ''
        Array.from(schemaIds).forEach((schemaId, index) => {
          if (index > 0) {
            tableIdsQuery += ' UNION ALL '
          }
          const [databaseName, schemaName] = schemaId.split('.')
          tableIdsQuery += `
            SELECT table_catalog, table_schema, table_name
            FROM ${databaseName}.information_schema.tables
            WHERE table_schema = '${schemaName.toUpperCase()}'
          `
        })
        console.log('tableIdsQuery: ', tableIdsQuery)
        const tableIdsQueryId = await executeQuery(tableIdsQuery)
        console.log('tableIdsQueryId: ', tableIdsQueryId)
        // get tableIds once query is complete
        const tableIdsQueryResultsData = await getQueryResults(tableIdsQueryId)
        tableIdsQueryResultsData.rows.forEach((row: string[]) => {
          tableIds.add(row[0] + '.' + row[1] + '.' + row[2])
        })
        console.log('tableIds: ', tableIds)

        // expand tables into columns
        // query for columnIds
        const columnIds = new Set<{ columnId: string; dataType: string }>([])
        let columnIdsQuery = ''
        Array.from(tableIds).forEach((tableId, index) => {
          if (index > 0) {
            columnIdsQuery += ' UNION ALL '
          }
          const [databaseName, schemaName, tableName] = tableId.split('.')
          columnIdsQuery += `
            SELECT table_catalog, table_schema, table_name, column_name, data_type
            FROM ${databaseName}.information_schema.columns
            WHERE table_schema = '${schemaName.toUpperCase()}' AND table_name = '${tableName.toUpperCase()}'
          `
        })
        console.log('columnIdsQuery: ', columnIdsQuery)
        const columnIdsQueryId = await executeQuery(columnIdsQuery)
        console.log('columnIdsQueryId: ', columnIdsQueryId)
        // get columnIds once query is complete
        const columnIdsQueryResultsData = await getQueryResults(
          columnIdsQueryId
        )
        columnIdsQueryResultsData.rows.forEach((row: string[]) => {
          columnIds.add({
            columnId: row[0] + '.' + row[1] + '.' + row[2] + '.' + row[3],
            dataType: row[4],
          })
        })
        console.log('columnIds: ', columnIds)

        // add to data model
        const dataModelTables: DataModelTables = {}
        Array.from(columnIds).forEach(({ columnId, dataType }) => {
          const [databaseName, schemaName, tableName, columnName] =
            columnId.split('.')
          const tableId = databaseName + '.' + schemaName + '.' + tableName
          dataModelTables[tableId] = {
            ...dataModelTables[tableId],
            [columnName]: dataType,
          }
        })
        dataModels.push({
          databaseConnectionId: databaseConnectionId,
          tables: dataModelTables,
        } as DataModel)
      }

      console.log('dataModels: ', dataModels)
      return res.status(200).json({ dataModels })
    } catch (error: unknown) {
      console.error('\nError: ', error)
      return res.status(500).json({
        error: error,
      })
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({ error: 'Method not allowed' })
  }
}

export default Sentry.withSentryAPI(
  handler,
  'api/v1/mbot/[organizationId]/data-models'
)
