import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../contexts/auth'
import { useEditability } from '../../contexts/editability'
import { useGraph } from '../../contexts/graph'
import { useQueries } from '../../contexts/queries'
import {
  QueryData,
  getLastUpdatedAt,
  getLatestQueryId,
  parameterizeStatement,
} from '../../utils/queryUtils'
import { supabase } from '../../utils/supabaseClient'
import { MetricNodeProperties } from './MetricNode'
import { SOURCE_USER_INPUT_COLUMNS } from './metric_detail/MetricDetail'

export type QueryError = {
  error: string
}
export type QueryResult = {
  status:
    | 'unexecuted'
    | 'unauthorized'
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
const QueryRunner: FunctionComponent<QueryRunnerProps> = ({
  parentMetricNodeData,
  refreshes,
  queryResult,
  setQueryResult,
}) => {
  const { getValidAccessToken } = useAuth()
  const { editingEnabled } = useEditability()
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
  const [queryUpdatedAt, setQueryUpdatedAt] = useState<Date | null>(null)

  const [parentPopulated, setParentPopulated] = useState(false)
  useEffect(() => {
    setParentPopulated(
      Boolean(
        initialGraph.nodes
          .map((n) => n.id)
          .includes(parentMetricNodeData?.id) &&
          parentMetricNodeData?.source?.databaseConnectionId &&
          parentMetricNodeData?.source?.query &&
          parentMetricNodeData?.source?.queryType &&
          ((parentMetricNodeData?.source?.dbtProjectGraphSyncId &&
            parentMetricNodeData?.source?.dbtProjectMetricPath) ||
            parentMetricNodeData?.source?.queryType === 'freeform')
      )
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
    if (accessToken && parentPopulated) {
      try {
        const _queryId = await getLatestQueryId(
          parameterizeStatement(
            parentMetricNodeData?.source?.query,
            queryParameters
          ),
          parentMetricNodeData?.source?.databaseConnectionId,
          parentMetricNodeData?.id,
          supabase
        )
        setQueryId(_queryId || 'unexecuted')
        setGetQueryIdComplete(true)
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [
    getQueryIdComplete,
    getValidAccessToken,
    parentPopulated,
    parentMetricNodeData?.source?.query,
    parentMetricNodeData?.source?.databaseConnectionId,
    parentMetricNodeData?.id,
    queryParameters,
  ])

  useEffect(() => {
    getQueryId()
  }, [getQueryId])

  const checkForQueryUpdate = useCallback(async () => {
    const accessToken = getValidAccessToken()
    if (accessToken && queryId) {
      try {
        const _queryUpdatedAt = await getLastUpdatedAt(
          'database_queries',
          {
            database_connection_id:
              parentMetricNodeData?.source?.databaseConnectionId,
            parent_node_id: parentMetricNodeData?.id,
          },
          supabase
        )
        if (
          _queryUpdatedAt &&
          queryUpdatedAt &&
          _queryUpdatedAt > queryUpdatedAt
        ) {
          setGetQueryIdComplete(false)
        }
        setQueryUpdatedAt(_queryUpdatedAt)
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [
    getValidAccessToken,
    queryId,
    parentMetricNodeData?.source?.databaseConnectionId,
    parentMetricNodeData?.id,
    queryUpdatedAt,
  ])

  // periodically check if reload available
  useEffect(() => {
    const interval = setInterval(() => {
      if (!editingEnabled) {
        checkForQueryUpdate()
      }
    }, 1000 * 10)
    return () => clearInterval(interval)
  }, [editingEnabled, checkForQueryUpdate])

  const cancelQuery = useCallback(async () => {
    const accessToken = getValidAccessToken()
    if (accessToken && queryId) {
      fetch('/api/v1/database-queries/' + queryId + '/cancel', {
        method: 'POST',
        headers: {
          'supabase-access-token': accessToken,
        },
      })
    }
  }, [getValidAccessToken, queryId])
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
    if (!parentMetricNodeData?.id) {
      // show loading while initializing
      setQueryResult({
        status: 'processing',
        data: null,
      })
      return
    }

    // special cases
    const accessToken = getValidAccessToken()
    if (!accessToken) {
      setQueryResult({
        status: 'unauthorized',
        data: null,
      })
      return
    }

    if (
      !initialGraph.nodes.map((n) => n.id).includes(parentMetricNodeData?.id)
    ) {
      setQueryResult({
        status: 'parent_unsaved',
        data: null,
      })
      return
    }

    if (parentMetricNodeData?.source?.type === 'userInput') {
      setQueryResult({
        status: 'success',
        data: {
          columns: SOURCE_USER_INPUT_COLUMNS.slice(0, 3),
          rows:
            parentMetricNodeData?.source?.userInputRows?.map((d) => [
              new Date(d.date || 'x'),
              d.dimension === '' || d.dimension === 'null' ? null : d.dimension,
              d.value,
            ]) || [],
          executedAt: new Date(),
        },
      })
      return
    }

    if (!parentPopulated) {
      setQueryResult({
        status: 'parent_empty',
        data: null,
      })
      return
    }

    if (queryId === 'unexecuted') {
      setQueryResult({
        status: 'unexecuted',
        data: null,
      })
      return
    }

    // normal loading
    if (!queryId) {
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
          response.json().then((data: QueryData) => {
            // convert any date columns since serialization loses type
            data.columns.forEach((column, columnIndex) => {
              if (column.type === 'date') {
                data.rows.forEach((row, rowIndex) => {
                  data.rows[rowIndex][columnIndex] = new Date(
                    row[columnIndex] as string
                  )
                })
              }
            })
            setQueryResult({
              status: 'success',
              data: data,
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
      .catch((error: unknown) => {
        console.error(error)
      })
  }, [
    getValidAccessToken,
    parentMetricNodeData?.id,
    parentMetricNodeData?.source?.type,
    parentMetricNodeData?.source?.userInputRows,
    initialGraph.nodes,
    parentPopulated,
    queryId,
    setQueryResult,
  ])

  useEffect(() => {
    getQueryResult()
  }, [getQueryResult])

  const executeQuery = useCallback(async () => {
    const accessToken = getValidAccessToken()
    if (accessToken && parentPopulated) {
      setQueryId('')
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
    parentPopulated,
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
      if (editingEnabled) {
        // user changed the query, execute it
        executeQuery()
      } else {
        // user canceled or someone else changed the query, reset
        setGetQueryIdComplete(false)
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

export default QueryRunner
