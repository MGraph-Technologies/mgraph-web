import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

import { QueryData, QueryRow } from '../components/graph/QueryRunner'

export const getLatestQueryId = async (
  statement: string,
  databaseConnectionId: string,
  parentNodeId: string,
  supabase: SupabaseClient
) => {
  let queryId: string | null = null
  try {
    const { data, error, status } = await supabase
      .from('database_queries')
      .select('id')
      .is('deleted_at', null)
      .match({
        database_connection_id: databaseConnectionId,
        parent_node_id: parentNodeId,
        statement: statement,
      })
      .order('created_at', { ascending: false })
      .limit(1)

    if (error && status !== 406) {
      throw error
    }

    if (data && data.length > 0) {
      queryId = data[0].id
    }
  } catch (error: unknown) {
    console.error(error)
  }

  return queryId
}

/* On getQueryParameters, blank queryParameters values are initialized for the set of
  parameter keys which have either a user-specfic or org-default value in the
  database. These are then populated with database values to the extent possible.
  Parameters which have neither a user nor org default value are added to the
  queryParameters object at ControlPanel render time. Parameters compile as blank
  within queries until a saved value is in effect. */
type QueryParameterValues = {
  userRecordId: string
  userValue: string // what is in effect for the user and injected into queries
  orgDefaultRecordId: string
  orgDefaultValue: string // used if no overriding user-specific record
}

export type QueryParameters = {
  [name: string]: QueryParameterValues
}

export type QueryParameterOverrides = {
  [name: string]: string
}

export const checkColumnsStructure = (queryData: QueryData) => {
  const snowflakeDateTypes = [
    'DATE',
    'TIMESTAMP',
    'TIMESTAMPNTZ',
    'TIMESTAMPLTZ',
    'TIMESTAMPTZ',
  ]
  const snowflakeStringTypes = [
    'CHAR',
    'CHARACTER',
    'STRING',
    'TEXT',
    'VARCHAR',
  ]
  const snowflakeNumberTypes = [
    'DECIMAL',
    'DOUBLE',
    'DOUBLE PRECISION',
    'FIXED',
    'FLOAT',
    'FLOAT4',
    'FLOAT8',
    'INTEGER',
    'NUMBER',
    'NUMERIC',
    'REAL',
  ]
  const columns = queryData.columns
  return (
    columns &&
    columns.length === 3 &&
    snowflakeDateTypes.includes(columns[0].type.toUpperCase()) &&
    snowflakeStringTypes.includes(columns[1].type.toUpperCase()) &&
    snowflakeNumberTypes.includes(columns[2].type.toUpperCase())
  )
}

export const getQueryParameters = async (
  organizationId: string,
  supabase: SupabaseClient,
  userId?: string
) => {
  let queryParameters: QueryParameters = {}
  try {
    const { data, error, status } = await supabase
      .from('database_query_parameters')
      .select('id, user_id, name, value, deleted_at')
      /* in frontend use, rls also limits to records from user's org where
        user_id is user's or null */
      .eq('organization_id', organizationId)
      .or('user_id.is.null' + (userId ? ',user_id.eq.' + userId : ''))
      /* output user's records first, so below logic to overwrite deleted user
        records with org default records will work */
      .order('user_id', { ascending: true })
      // in case of dupes, use first one
      .order('created_at', { ascending: true })

    if (error && status !== 406) {
      throw error
    }

    if (data) {
      const names = new Set(data.map((row) => row.name))
      queryParameters = formQueryParametersScaffold(
        Array.from(names),
        queryParameters
      )
      // dedupe data
      data
        .filter(
          (row, index, self) =>
            index ===
            self.findIndex(
              (r) => r.name === row.name && r.user_id === row.user_id
            )
          // set queryParameters
        )
        .forEach((row) => {
          if (row.user_id) {
            queryParameters = {
              ...queryParameters,
              [row.name]: {
                ...queryParameters[row.name],
                userRecordId: row.id,
                userValue: row.deleted_at === null ? row.value : '',
              },
            }
          } else {
            const userValueExists = data.some(
              (r) => r.name === row.name && r.user_id && r.deleted_at === null
            )
            queryParameters = {
              ...queryParameters,
              [row.name]: {
                userRecordId: queryParameters[row.name].userRecordId,
                userValue: userValueExists
                  ? queryParameters[row.name].userValue
                  : row.value,
                orgDefaultRecordId: row.id,
                orgDefaultValue: row.value,
              },
            }
          }
        })
    }
  } catch (error: unknown) {
    console.error(error)
  }
  return queryParameters
}

export const formQueryParametersScaffold = (
  names: string[],
  queryParameters: QueryParameters
) => {
  let newQueryParameters = { ...queryParameters }
  names.forEach((name) => {
    newQueryParameters = {
      ...newQueryParameters,
      [name]: {
        userRecordId: uuidv4(),
        userValue: '',
        orgDefaultRecordId: uuidv4(),
        orgDefaultValue: '',
      },
    }
  })
  return newQueryParameters
}

export const overrideQueryParameters = (
  queryParameters: QueryParameters,
  queryParameterOverrides: QueryParameterOverrides
) => {
  let newQueryParameters = { ...queryParameters }
  Object.entries(queryParameterOverrides).forEach(([name, value]) => {
    if (!Object.keys(newQueryParameters).includes(name)) {
      newQueryParameters = formQueryParametersScaffold(
        [name],
        newQueryParameters
      )
    }
    newQueryParameters[name].userValue = value
  })
  return newQueryParameters
}

export const parameterizeStatement = (
  statement: string,
  queryParameters: QueryParameters
) => {
  return statement.replace(/{{(\w+)}}/g, (_match, p1) => {
    const snakeCaseName = p1.toLowerCase().replace(/ /g, '_')
    if (queryParameters[snakeCaseName]) {
      return queryParameters[snakeCaseName].userValue
    } else {
      return ''
    }
  })
}

export const snowflakeDateToJsDate = (snowflakeDate: string) => {
  // strip tz info
  const _snowflakeDate = snowflakeDate.replace(/(Z|[-+]\d{2}:\d{2})$/, '')
  const date = new Date(_snowflakeDate + 'Z')
  return date
}

export const sortQueryRowsByDate = (rows: QueryRow[]) => {
  return rows.sort((a: QueryRow, b: QueryRow) => {
    const aDate = snowflakeDateToJsDate(a[0])
    const bDate = snowflakeDateToJsDate(b[0])
    return aDate.getTime() - bDate.getTime()
  })
}
