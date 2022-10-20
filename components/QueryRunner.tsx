import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { useGraph } from '../contexts/graph'
import {
  getLatestQueryId,
  parameterizeStatement,
} from '../utils/queryParameters'
import { supabase } from '../utils/supabaseClient'

export type QueryResult = {
  status:
    | 'unexecuted'
    | 'success'
    | 'processing'
    | 'expired'
    | 'error'
    | 'empty'
  data: any | null
}

type QueryRunnerProps = {
  statement: string
  databaseConnectionId: string
  parentNodeId: string
  refreshes: number // increment this number to force a refresh
  queryResult: QueryResult
  setQueryResult: (queryResult: QueryResult) => void
}
/* TODO: it seems a little strange that this is a component, but it operates
    entirely in background / on state and doesn't render anything. Should
    either build confidence or refactor :) */
const QueryRunner: FunctionComponent<QueryRunnerProps> = ({
  statement,
  databaseConnectionId,
  parentNodeId,
  refreshes,
  queryResult,
  setQueryResult,
}) => {
  const { session } = useAuth()
  const {
    globalQueryRefreshes,
    setGlobalQueryRefreshes,
    setQueriesLoading,
    queryParameters,
  } = useGraph()
  const [queryId, setQueryId] = useState('')
  const [getQueryIdComplete, setGetQueryIdComplete] = useState(false)
  const [getQueryResultComplete, setGetQueryResultComplete] = useState(false)

  useEffect(() => {
    if (parentNodeId) {
      setQueriesLoading!((prev) => {
        return queryResult.status === 'processing'
          ? [...prev, parentNodeId]
          : prev.filter((id) => id !== parentNodeId)
      })
    }
    return () => {
      setQueriesLoading!((prev) => prev.filter((id) => id !== parentNodeId))
    }
  }, [setQueriesLoading, queryResult, parentNodeId])

  const getQueryId = useCallback(async () => {
    if (getQueryIdComplete) {
      return
    }
    const accessToken = session?.access_token
    if (accessToken && databaseConnectionId && parentNodeId && statement) {
      try {
        let queryId = await getLatestQueryId(
          parameterizeStatement(statement, queryParameters),
          databaseConnectionId,
          parentNodeId,
          supabase
        )
        if (queryId) {
          setQueryId(queryId)
          setGetQueryIdComplete(true)
        } else {
          setQueryResult({
            status: 'unexecuted',
            data: null,
          })
          setGetQueryResultComplete(true)
          setGetQueryIdComplete(true)
        }
      } catch (error: any) {
        console.error(error.message)
      }
    }
  }, [
    getQueryIdComplete,
    session?.access_token,
    parentNodeId,
    databaseConnectionId,
    statement,
    queryParameters,
    setQueryResult,
  ])
  useEffect(() => {
    getQueryId()
  }, [getQueryId])

  const getQueryResult = useCallback(async () => {
    if (getQueryResultComplete) {
      return
    }
    const accessToken = session?.access_token
    if (accessToken && queryId) {
      fetch('/api/v1/database-queries/' + queryId + '/results', {
        method: 'GET',
        headers: {
          'supabase-access-token': accessToken,
        },
      })
        .then((response) => {
          setGetQueryResultComplete(true)
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
          } else {
            response.json().then((data) => {
              setQueryResult({
                status: 'error',
                data: {
                  error: data.error,
                },
              })
            })
          }
        })
        .catch((error) => {
          console.error(error.message)
        })
    }
  }, [getQueryResultComplete, session?.access_token, queryId, setQueryResult])

  useEffect(() => {
    getQueryResult()
  }, [getQueryResult])

  const executeQuery = useCallback(async () => {
    const accessToken = session?.access_token
    if (accessToken && parentNodeId && databaseConnectionId && statement) {
      setQueryResult({
        status: 'processing',
        data: null,
      })
      const queryBody = {
        databaseConnectionId: databaseConnectionId,
        parentNodeId: parentNodeId,
        statement: parameterizeStatement(statement, queryParameters),
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
              error: error.message,
            },
          })
        })
    }
  }, [
    session?.access_token,
    databaseConnectionId,
    parentNodeId,
    statement,
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

  return <></>
}

export default QueryRunner
