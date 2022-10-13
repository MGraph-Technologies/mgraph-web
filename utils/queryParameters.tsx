import { SupabaseClient } from "@supabase/supabase-js"
import { v4 as uuidv4 } from 'uuid'

type QueryParameterValues = {
  userRecordId: string
  userValue: string // what is in effect for the user and injected into queries
  orgDefaultRecordId: string
  orgDefaultValue: string // used if no overriding user-specific record
}

export type QueryParameters = {
  [name: string]: QueryParameterValues
}

export const getLatestQueryId = async (
  statement: string,
  databaseConnectionId: string,
  parentNodeId: string,
  supabase: SupabaseClient,
) => {
  let queryId: string | null = null
  try {
    let { data, error, status } = await supabase
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
  } catch (error: any) {
    console.error(error.message)
  }
  
  return queryId
}


export const getQueryParameters = async (
  organizationId: string,
  supabase: SupabaseClient,
  userId?: string
) => {
  let queryParameters: QueryParameters = {}
  try {
    let { data, error, status } = await supabase
      .from('database_query_parameters')
      .select('id, user_id, name, value, deleted_at')
      /* in frontend use, rls also limits to records from user's org where
        user_id is user's or null */
      .eq('organization_id', organizationId)
      .or('user_id.is.null' + (userId ? ',user_id.eq.' + userId : ''))
      /* output user's records first, so below logic to overwrite deleted user
        records with org default records will work */
      .order('user_id', { ascending: true })
      // in rare case of multiple org defaults, use first one
      .order('created_at', { ascending: true })

    if (error && status !== 406) {
      throw error
    }

    if (data) {
      // initializing record ids enables upserts to work (idempotently) if there's no existing pg record
      const names = data.map((row) => row.name)
      queryParameters = initializeQueryParameters(names, queryParameters)
      // populate with real records where available
      data.forEach((row) => {
        if (row.user_id) {
          queryParameters = {
            ...queryParameters,
            [row.name]: {
              userRecordId: row.id,
              userValue: row.deleted_at === null ? row.value : '',
              orgDefaultRecordId: queryParameters[row.name].orgDefaultRecordId,
              orgDefaultValue: queryParameters[row.name].orgDefaultValue,
            },
          }
        } else {
          queryParameters = {
            ...queryParameters,
            [row.name]: {
              userRecordId: queryParameters[row.name].userRecordId,
              userValue: queryParameters[row.name].userValue
                ? queryParameters[row.name].userValue
                : row.value,
              orgDefaultRecordId: row.id,
              orgDefaultValue: row.value,
            },
          }
        }
      })
    }
  } catch (error: any) {
    console.error(error.message)
  }
  return queryParameters
}

export const initializeQueryParameters = (
  names: string[],
  queryParameters: QueryParameters,
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

export const parameterizeStatement = (
  statement: string,
  queryParameters: QueryParameters
) => {
  return statement.replace(/{{(.*?)}}/g, (_match, p1) => {
    const snakeCaseName = p1.toLowerCase().replace(/ /g, '_')
    if (queryParameters[snakeCaseName]) {
      return queryParameters[snakeCaseName].userValue
    } else {
      return '{{' + p1 + '}}'
    }
  })
}