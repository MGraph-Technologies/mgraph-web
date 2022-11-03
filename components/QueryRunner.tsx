import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { useGraph } from '../contexts/graph'
import {
  getLatestQueryId,
  parameterizeStatement,
} from '../utils/queryParameters'
import { supabase } from '../utils/supabaseClient'
import { MetricNodeProperties } from './graph/MetricNode'

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
  parentMetricNodeData: MetricNodeProperties
  refreshes: number // increment this number to force a refresh
  queryResult: QueryResult
  setQueryResult: (queryResult: QueryResult) => void
}
/* TODO: it seems a little strange that this is a component, but it operates
    entirely in background / on state and doesn't render anything. Should
    either build confidence or refactor :) */
const QueryRunner: FunctionComponent<QueryRunnerProps> = ({
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
  } = useGraph()
  const [queryId, setQueryId] = useState('')
  const [getQueryIdComplete, setGetQueryIdComplete] = useState(false)
  const [getQueryResultComplete, setGetQueryResultComplete] = useState(false)

  const shouldRunQuery = useCallback(() => {
    return (
      parentMetricNodeData?.sourceCode &&
      parentMetricNodeData?.sourceCodeLanguage &&
      parentMetricNodeData?.sourceDatabaseConnectionId &&
      ((parentMetricNodeData?.sourceSyncId &&
        parentMetricNodeData?.sourceSyncPath) ||
        parentMetricNodeData?.sourceCodeLanguage !== 'yaml')
    )
  }, [parentMetricNodeData])

  useEffect(() => {
    const parentNodeId = parentMetricNodeData?.id
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
  }, [parentMetricNodeData?.id, setQueriesLoading, queryResult])

  const getQueryId = useCallback(async () => {
    if (getQueryIdComplete) {
      return
    }
    const accessToken = session?.access_token
    if (accessToken && shouldRunQuery()) {
      try {
        let queryId = await getLatestQueryId(
          parameterizeStatement(
            parentMetricNodeData?.sourceCode,
            queryParameters
          ),
          parentMetricNodeData?.sourceDatabaseConnectionId,
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
      } catch (error: any) {
        console.error(error.message)
      }
    }
  }, [
    getQueryIdComplete,
    session?.access_token,
    shouldRunQuery,
    parentMetricNodeData?.sourceCode,
    parentMetricNodeData?.sourceDatabaseConnectionId,
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
      .catch((error) => {
        console.error(error.message)
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
        databaseConnectionId: parentMetricNodeData?.sourceDatabaseConnectionId,
        parentNodeId: parentMetricNodeData?.id,
        statement: parameterizeStatement(
          parentMetricNodeData?.sourceCode,
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
              error: error.message,
            },
          })
        })
    }
  }, [
    session?.access_token,
    shouldRunQuery,
    parentMetricNodeData?.sourceDatabaseConnectionId,
    parentMetricNodeData?.id,
    parentMetricNodeData?.sourceCode,
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
      parentMetricNodeData?.sourceCode,
      parentMetricNodeData?.sourceCodeLanguage,
      parentMetricNodeData?.sourceDatabaseConnectionId,
      parentMetricNodeData?.sourceSyncId,
      parentMetricNodeData?.sourceSyncPath,
    ]
  )
  return <></>
}

export default QueryRunner
