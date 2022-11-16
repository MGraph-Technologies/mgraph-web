import { SupabaseClient } from '@supabase/supabase-js'
import {
  Dispatch,
  FunctionComponent,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useEffect,
  useState,
  useContext,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import { MetricNodeProperties } from '../components/graph/MetricNode'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './auth'

type QueryParameterValues = {
  userRecordId: string
  userValue: string // what is in effect for the user and injected into queries
  orgDefaultRecordId: string
  orgDefaultValue: string // used if no overriding user-specific record
}

export type QueryParameters = {
  [name: string]: QueryParameterValues
}

export type QueryColumn = {
  name: string
  type: string
}
export type QueryRow = string[]
export type QueryData = {
  columns: QueryColumn[]
  rows: QueryRow[]
  executedAt: Date
}
export type QueryError = {
  error: string
}
export type QueryResult = {
  status:
    | 'unexecuted'
    | 'success'
    | 'processing'
    | 'expired'
    | 'error'
    | 'empty'
  data: QueryData | QueryError | null
}

type QueriesContextType = {
  globalQueryRefreshes: number
  setGlobalQueryRefreshes: Dispatch<SetStateAction<number>> | undefined
  queriesLoading: Array<string>
  /* ^would prefer to use a Set here, but that doesn't work with useState
    https://stackoverflow.com/questions/58806883/how-to-use-set-with-reacts-usestate */
  setQueriesLoading: Dispatch<SetStateAction<Array<string>>> | undefined
  queriesToCancel: Array<string>
  setQueriesToCancel: Dispatch<SetStateAction<Array<string>>> | undefined
  queryParameters: QueryParameters
  initializeQueryParameter: ((name: string) => void) | undefined
  resetQueryParameterUserValue: ((name: string) => Promise<void>) | undefined
  setQueryParameterUserValue:
    | ((name: string, value: string) => Promise<void>)
    | undefined
  setQueryParameterOrgDefaultValue:
    | ((name: string, value: string) => Promise<void>)
    | undefined
}

const queriesContextDefaultValues: QueriesContextType = {
  globalQueryRefreshes: 0,
  setGlobalQueryRefreshes: undefined,
  queriesLoading: [] as string[],
  setQueriesLoading: undefined,
  queriesToCancel: [] as string[],
  setQueriesToCancel: undefined,
  queryParameters: {},
  initializeQueryParameter: undefined,
  resetQueryParameterUserValue: undefined,
  setQueryParameterUserValue: undefined,
  setQueryParameterOrgDefaultValue: undefined,
}
const QueriesContext = createContext<QueriesContextType>(
  queriesContextDefaultValues
)

export function useQueries() {
  return useContext(QueriesContext)
}

type QueriesProps = {
  children: ReactNode
}

export function QueriesProvider({ children }: QueriesProps) {
  const { session, organizationId } = useAuth()

  const [globalQueryRefreshes, setGlobalQueryRefreshes] = useState(0)
  const [queriesLoading, setQueriesLoading] = useState([] as string[])
  const [queriesToCancel, setQueriesToCancel] = useState([] as string[])

  const [queryParameters, setQueryParameters] = useState<QueryParameters>({})

  const populateQueryParameters = useCallback(async () => {
    if (organizationId && session?.user) {
      const queryParameters = await getQueryParameters(
        organizationId,
        supabase,
        session.user.id
      )
      setQueryParameters(queryParameters)
    }
  }, [organizationId, session])
  useEffect(() => {
    populateQueryParameters()
  }, [populateQueryParameters])

  const initializeQueryParameter = (name: string) => {
    setQueryParameters((prev) => initializeQueryParameters([name], prev))
  }

  const resetQueryParameterUserValue = useCallback(
    async (name: string) => {
      let qp = queryParameters[name]
      if (qp) {
        try {
          await supabase
            .from('database_query_parameters')
            .upsert({
              id: qp.userRecordId,
              organization_id: organizationId,
              user_id: session?.user?.id,
              name: name,
              value: qp.userValue,
              updated_at: new Date(),
              deleted_at: new Date(),
            })
            .then(() => {
              qp = {
                ...qp,
                userValue: qp.orgDefaultValue,
              }
              setQueryParameters((prev) => ({
                ...prev,
                [name]: qp,
              }))
            })
        } catch (error: unknown) {
          console.error(error)
        }
      }
    },
    [queryParameters, organizationId, session]
  )

  const setQueryParameterUserValue = useCallback(
    async (name: string, value: string) => {
      let qp = queryParameters[name]
      if (qp) {
        if (value === qp.orgDefaultValue) {
          resetQueryParameterUserValue(name)
        } else {
          try {
            await supabase
              .from('database_query_parameters')
              .upsert({
                id: qp.userRecordId,
                organization_id: organizationId,
                user_id: session?.user?.id,
                name: name,
                value: value,
                updated_at: new Date(),
                deleted_at: null,
              })
              .then(() => {
                qp = {
                  ...qp,
                  userValue: value,
                }
                setQueryParameters((prev) => ({
                  ...prev,
                  [name]: qp,
                }))
              })
          } catch (error: unknown) {
            console.error(error)
          }
        }
      }
    },
    [queryParameters, resetQueryParameterUserValue, organizationId, session]
  )

  const setQueryParameterOrgDefaultValue = useCallback(
    async (name: string, value: string) => {
      let qp = queryParameters[name]
      if (qp) {
        try {
          await supabase
            .from('database_query_parameters')
            .upsert([
              {
                id: qp.orgDefaultRecordId,
                organization_id: organizationId,
                user_id: null,
                name: name,
                value: value,
                updated_at: new Date(),
                deleted_at: null,
              },
              {
                id: qp.userRecordId,
                organization_id: organizationId,
                user_id: session?.user?.id,
                name: name,
                value: qp.userValue,
                updated_at: new Date(),
                deleted_at: new Date(),
              },
            ])
            .then(() => {
              qp = {
                ...qp,
                orgDefaultValue: value,
                userValue: value,
              }
              setQueryParameters((prev) => ({
                ...prev,
                [name]: qp,
              }))
            })
        } catch (error: unknown) {
          console.error(error)
        }
      }
    },
    [queryParameters, organizationId, session]
  )

  const value = {
    globalQueryRefreshes: globalQueryRefreshes,
    setGlobalQueryRefreshes: setGlobalQueryRefreshes,
    queriesLoading: queriesLoading,
    setQueriesLoading: setQueriesLoading,
    queriesToCancel: queriesToCancel,
    setQueriesToCancel: setQueriesToCancel,
    queryParameters: queryParameters,
    initializeQueryParameter: initializeQueryParameter,
    resetQueryParameterUserValue: resetQueryParameterUserValue,
    setQueryParameterUserValue: setQueryParameterUserValue,
    setQueryParameterOrgDefaultValue: setQueryParameterOrgDefaultValue,
  }
  return (
    <>
      <QueriesContext.Provider value={value}>
        {children}
      </QueriesContext.Provider>
    </>
  )
}

/* TODO: it seems a little strange that this is a component, given it operates
    entirely in background / on state and doesn't render anything. However, it's quite
    convenient for maintaining multiple instances. Should either build confidence
    or refactor :) */
type QueryRunnerProps = {
  parentMetricNodeData: MetricNodeProperties
  refreshes: number // increment this number to force a refresh
  queryResult: QueryResult
  setQueryResult: (queryResult: QueryResult) => void
}
export const QueryRunner: FunctionComponent<QueryRunnerProps> = ({
  parentMetricNodeData,
  refreshes,
  queryResult,
  setQueryResult,
}) => {
  const { session } = useAuth()
  const {
    globalQueryRefreshes,
    setGlobalQueryRefreshes,
    setQueriesLoading,
    queriesToCancel,
    setQueriesToCancel,
    queryParameters,
  } = useQueries()
  const [queryId, setQueryId] = useState('')
  const [getQueryIdComplete, setGetQueryIdComplete] = useState(false)
  const [getQueryResultComplete, setGetQueryResultComplete] = useState(false)

  const shouldRunQuery = useCallback(() => {
    return (
      parentMetricNodeData?.source?.databaseConnectionId &&
      parentMetricNodeData?.source?.query &&
      parentMetricNodeData?.source?.queryType &&
      ((parentMetricNodeData?.source?.dbtProjectGraphSyncId &&
        parentMetricNodeData?.source?.dbtProjectMetricPath) ||
        parentMetricNodeData?.source?.queryType === 'freeform')
    )
  }, [parentMetricNodeData])

  useEffect(() => {
    const parentNodeId = parentMetricNodeData?.id
    if (parentNodeId) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setQueriesLoading!((prev) => {
        return queryResult.status === 'processing'
          ? [...prev, parentNodeId]
          : prev.filter((id) => id !== parentNodeId)
      })
    }
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setQueriesLoading!((prev) => prev.filter((id) => id !== parentNodeId))
    }
  }, [parentMetricNodeData?.id, setQueriesLoading, queryResult])

  const getQueryId = useCallback(async () => {
    if (getQueryIdComplete) {
      return
    }
    const accessToken = session?.access_token
    if (accessToken && shouldRunQuery()) {
      try {
        const queryId = await getLatestQueryId(
          parameterizeStatement(
            parentMetricNodeData?.source?.query,
            queryParameters
          ),
          parentMetricNodeData?.source?.databaseConnectionId,
          parentMetricNodeData?.id,
          supabase
        )
        if (queryId) {
          setQueryId(queryId)
        } else {
          setQueryResult({
            status: 'unexecuted',
            data: null,
          })
          setGetQueryResultComplete(true)
        }
        setGetQueryIdComplete(true)
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [
    getQueryIdComplete,
    session?.access_token,
    shouldRunQuery,
    parentMetricNodeData?.source?.query,
    parentMetricNodeData?.source?.databaseConnectionId,
    parentMetricNodeData?.id,
    queryParameters,
    setQueryResult,
  ])
  useEffect(() => {
    getQueryId()
  }, [getQueryId])

  const cancelQuery = useCallback(async () => {
    if (getQueryResultComplete) {
      return
    }
    const accessToken = session?.access_token
    if (accessToken && queryId) {
      fetch('/api/v1/database-queries/' + queryId + '/cancel', {
        method: 'POST',
        headers: {
          'supabase-access-token': accessToken,
        },
      })
    }
  }, [getQueryResultComplete, session?.access_token, queryId])
  useEffect(() => {
    const parentNodeId = parentMetricNodeData?.id
    if (queriesToCancel?.includes(parentNodeId)) {
      cancelQuery()
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      setQueriesToCancel!(queriesToCancel.filter((id) => id !== parentNodeId))
    }
  }, [
    parentMetricNodeData?.id,
    queriesToCancel,
    setQueriesToCancel,
    cancelQuery,
  ])

  const getQueryResult = useCallback(async () => {
    if (getQueryResultComplete) {
      return
    }
    if (!parentMetricNodeData) {
      setQueryResult({
        status: 'processing',
        data: null,
      })
      return
    }

    if (!shouldRunQuery()) {
      setQueryResult({
        status: 'empty',
        data: null,
      })
      return
    }

    const accessToken = session?.access_token
    if (!accessToken || !queryId) {
      setQueryResult({
        status: 'processing',
        data: null,
      })
      return
    }

    fetch('/api/v1/database-queries/' + queryId + '/results', {
      method: 'GET',
      headers: {
        'supabase-access-token': accessToken,
      },
    })
      .then((response) => {
        if (response.status === 200) {
          response.json().then((data) => {
            setQueryResult({
              status: 'success',
              data: {
                columns: data.columns,
                rows: data.rows,
                executedAt: data.executedAt,
              },
            })
            setGetQueryResultComplete(true)
          })
        } else if (response.status === 202) {
          setQueryResult({
            status: 'processing',
            data: null,
          })
          setTimeout(() => {
            getQueryResult()
          }, 1000)
        } else if (response.status === 410) {
          setQueryResult({
            status: 'expired',
            data: null,
          })
          setGetQueryResultComplete(true)
        } else {
          response.json().then((data) => {
            setQueryResult({
              status: 'error',
              data: {
                error: data.error,
              },
            })
            setGetQueryResultComplete(true)
          })
        }
      })
      .catch((error: unknown) => {
        console.error(error)
      })
  }, [
    getQueryResultComplete,
    parentMetricNodeData,
    shouldRunQuery,
    session?.access_token,
    queryId,
    setQueryResult,
  ])

  useEffect(() => {
    getQueryResult()
  }, [getQueryResult])

  const executeQuery = useCallback(async () => {
    const accessToken = session?.access_token
    if (accessToken && shouldRunQuery()) {
      setQueryResult({
        status: 'processing',
        data: null,
      })
      const queryBody = {
        databaseConnectionId:
          parentMetricNodeData?.source?.databaseConnectionId,
        parentNodeId: parentMetricNodeData?.id,
        statement: parameterizeStatement(
          parentMetricNodeData?.source?.query,
          queryParameters
        ),
      }
      fetch('/api/v1/database-queries', {
        method: 'POST',
        body: JSON.stringify(queryBody),
        headers: {
          'supabase-access-token': accessToken,
        },
      })
        .then((response) => {
          if (response.status === 200) {
            response.json().then((data) => {
              setQueryId(data.queryId)
              setGetQueryResultComplete(false)
            })
          } else {
            throw new Error(response.statusText)
          }
        })
        .catch((error) => {
          setQueryResult({
            status: 'error',
            data: {
              error: error,
            },
          })
        })
    }
  }, [
    session?.access_token,
    shouldRunQuery,
    parentMetricNodeData?.source?.databaseConnectionId,
    parentMetricNodeData?.id,
    parentMetricNodeData?.source?.query,
    queryParameters,
    setQueryResult,
  ])

  useEffect(() => {
    if (refreshes > 0) {
      executeQuery()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshes])

  useEffect(() => {
    if (globalQueryRefreshes > 0 && setGlobalQueryRefreshes) {
      executeQuery()
      setGlobalQueryRefreshes(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalQueryRefreshes])

  useEffect(
    () => {
      if (getQueryResultComplete) {
        executeQuery()
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      parentMetricNodeData?.source?.query,
      parentMetricNodeData?.source?.queryType,
      parentMetricNodeData?.source?.databaseConnectionId,
      parentMetricNodeData?.source?.dbtProjectGraphSyncId,
      parentMetricNodeData?.source?.dbtProjectMetricPath,
    ]
  )
  return <></>
}

// below also used by api
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
  } catch (error: unknown) {
    console.error(error)
  }
  return queryParameters
}

export const initializeQueryParameters = (
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

export const parameterizeStatement = (
  statement: string,
  queryParameters: QueryParameters
) => {
  return statement.replace(/{{(\w+)}}/g, (_match, p1) => {
    const snakeCaseName = p1.toLowerCase().replace(/ /g, '_')
    if (queryParameters[snakeCaseName]) {
      return queryParameters[snakeCaseName].userValue
    } else {
      return '{{' + p1 + '}}'
    }
  })
}
