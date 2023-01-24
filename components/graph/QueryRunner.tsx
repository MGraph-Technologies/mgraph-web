import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../contexts/auth'
import { useGraph } from '../../contexts/graph'
import { useQueries } from '../../contexts/queries'
import { getLatestQueryId, parameterizeStatement } from '../../utils/queryUtils'
import { supabase } from '../../utils/supabaseClient'
import { MetricNodeProperties } from './MetricNode'

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
    | 'parent_unsaved'
    | 'parent_empty'
    | 'expired'
    | 'error'
  data: QueryData | QueryError | null
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
  const { getValidAccessToken } = useAuth()
  const { initialGraph } = useGraph()
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
      initialGraph.nodes.map((n) => n.id).includes(parentMetricNodeData?.id) &&
      parentMetricNodeData?.source?.databaseConnectionId &&
      parentMetricNodeData?.source?.query &&
      parentMetricNodeData?.source?.queryType &&
      ((parentMetricNodeData?.source?.dbtProjectGraphSyncId &&
        parentMetricNodeData?.source?.dbtProjectMetricPath) ||
        parentMetricNodeData?.source?.queryType === 'freeform')
    )
  }, [initialGraph.nodes, parentMetricNodeData])

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
    const accessToken = getValidAccessToken()
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
    getValidAccessToken,
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
    const accessToken = getValidAccessToken()
    if (accessToken && queryId) {
      fetch('/api/v1/database-queries/' + queryId + '/cancel', {
        method: 'POST',
        headers: {
          'supabase-access-token': accessToken,
        },
      })
    }
  }, [getQueryResultComplete, getValidAccessToken, queryId])
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

    if (
      !initialGraph.nodes.map((n) => n.id).includes(parentMetricNodeData.id)
    ) {
      setQueryResult({
        status: 'parent_unsaved',
        data: null,
      })
      return
    }

    if (!shouldRunQuery()) {
      setQueryResult({
        status: 'parent_empty',
        data: null,
      })
      return
    }

    const accessToken = getValidAccessToken()
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
              data: data as QueryData,
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
    initialGraph.nodes,
    shouldRunQuery,
    getValidAccessToken,
    queryId,
    setQueryResult,
  ])

  useEffect(() => {
    getQueryResult()
  }, [getQueryResult])

  const executeQuery = useCallback(async () => {
    const accessToken = getValidAccessToken()
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
    getValidAccessToken,
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
