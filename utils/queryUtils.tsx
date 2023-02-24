import { SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

import { ChartJSDatapoint } from 'components/graph/LineChart'

/***** QUERY EXECUTION STUFF *****/
// /results handles conversion from raw db formats to ones below
// we only convert dates and numbers currently, other types left as strings
export type QueryDataType = 'date' | 'number' | 'string'
export type QueryColumn = {
  name: string
  type: QueryDataType
}
export type QueryRow = unknown[]
export type QueryData = {
  columns: QueryColumn[]
  rows: QueryRow[]
  executedAt: Date
  metricDataVerified: boolean
}
export type MetricRow = [Date, string, number]
export type MetricData = {
  columns: QueryColumn[]
  rows: MetricRow[]
  executedAt: Date
  metricDataVerified: true
  metricDimensionsData: Map<string, ChartJSDatapoint[]>
}

export const getLastUpdatedAt = async (
  tableName: string,
  match: Record<string, unknown>,
  supabase: SupabaseClient
) => {
  let lastUpdatedAt: Date | null = null
  try {
    const { data, error, status } = await supabase
      .from(tableName)
      .select('updated_at')
      .match(match)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error && status !== 406) {
      throw error
    }

    if (data) {
      lastUpdatedAt = new Date(data.updated_at)
    }
  } catch (error: unknown) {
    console.error(error)
  }

  return lastUpdatedAt
}

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
      .single()

    if (error && status !== 406) {
      throw error
    }

    if (data) {
      const databaseQuery = data as {
        id: string
      }
      queryId = databaseQuery.id
    }
  } catch (error: unknown) {
    console.error(error)
  }

  return queryId
}

export const isVerifiedMetricData = (
  columns: QueryColumn[],
  rows: QueryRow[]
): boolean => {
  return Boolean(
    columns &&
      columns.length === 3 &&
      columns[0].type === 'date' &&
      columns[1].type === 'string' &&
      columns[2].type === 'number' &&
      rows &&
      rows.length > 0
  )
}

export const processQueryData = (data: QueryData): MetricData | QueryData => {
  const metricDataVerified = data.metricDataVerified
  const metricDimensionsData = new Map<string, ChartJSDatapoint[]>()
  data.rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const column = data.columns[columnIndex]
      if (column.type === 'date') {
        if (!value) return
        data.rows[rowIndex][columnIndex] = new Date(value as string)
      }
    })
    if (metricDataVerified) {
      const dimension = row[1] as string
      if (!metricDimensionsData.has(dimension)) {
        metricDimensionsData.set(dimension, [])
      }
      metricDimensionsData.get(dimension)?.push({
        x: row[0] as Date,
        y: row[2] as number,
      })
    }
  })
  return metricDataVerified
    ? ({
        ...data,
        metricDataVerified: true,
        metricDimensionsData,
      } as MetricData)
    : data
}

/***** INPUT PARAMETER STUFF *****/
/* On getInputParameters, blank inputParameters values are initialized for the set of
  parameter keys which have either a user-specfic or org-default value in the
  database. These are then populated with database values to the extent possible.
  Parameters which have neither a user nor org default value are added to the
  inputParameters object at ControlPanel render time. Parameters compile as blank
  within queries until a saved value is in effect. */
type InputParameterValues = {
  userRecordId: string
  userValue: string // what is in effect for the user and injected into queries
  orgDefaultRecordId: string
  orgDefaultValue: string // used if no overriding user-specific record
}

export type InputParameters = {
  [name: string]: InputParameterValues
}

export type InputParameterOverrides = {
  [name: string]: string
}

export const formInputParametersScaffold = (
  names: string[],
  inputParameters: InputParameters
) => {
  let newInputParameters = { ...inputParameters }
  names.forEach((name) => {
    newInputParameters = {
      ...newInputParameters,
      [name]: {
        userRecordId: uuidv4(),
        userValue: '',
        orgDefaultRecordId: uuidv4(),
        orgDefaultValue: '',
      },
    }
  })
  return newInputParameters
}

export const getInputParameters = async (
  organizationId: string,
  supabase: SupabaseClient,
  userId?: string
) => {
  let inputParameters: InputParameters = {}
  try {
    const { data, error, status } = await supabase
      .from('input_parameters')
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
      const _inputParameters = data as {
        id: string
        user_id: string | null
        name: string
        value: string
        deleted_at: string | null
      }[]
      const names = new Set(_inputParameters.map((row) => row.name))
      inputParameters = formInputParametersScaffold(
        Array.from(names),
        inputParameters
      )
      // dedupe data
      _inputParameters
        .filter(
          (row, index, self) =>
            index ===
            self.findIndex(
              (r) => r.name === row.name && r.user_id === row.user_id
            )
          // set inputParameters
        )
        .forEach((row) => {
          if (row.user_id) {
            inputParameters = {
              ...inputParameters,
              [row.name]: {
                ...inputParameters[row.name],
                userRecordId: row.id,
                userValue: row.deleted_at === null ? row.value : '',
              },
            }
          } else {
            const userValueExists = _inputParameters.some(
              (r) => r.name === row.name && r.user_id && r.deleted_at === null
            )
            inputParameters = {
              ...inputParameters,
              [row.name]: {
                userRecordId: inputParameters[row.name].userRecordId,
                userValue: userValueExists
                  ? inputParameters[row.name].userValue
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
  return inputParameters
}

export const overrideInputParameters = (
  inputParameters: InputParameters,
  inputParameterOverrides: InputParameterOverrides
) => {
  let newInputParameters = { ...inputParameters }
  Object.entries(inputParameterOverrides).forEach(([name, value]) => {
    if (!Object.keys(newInputParameters).includes(name)) {
      newInputParameters = formInputParametersScaffold(
        [name],
        newInputParameters
      )
    }
    newInputParameters[name].userValue = value
  })
  return newInputParameters
}

export const parameterizeStatement = (
  statement: string,
  inputParameters: InputParameters
) => {
  return statement.replace(/{{(\w+)}}/g, (_match, p1) => {
    const snakeCaseName = p1.toLowerCase().replace(/ /g, '_')
    if (inputParameters[snakeCaseName]) {
      return inputParameters[snakeCaseName].userValue
    } else {
      return ''
    }
  })
}
