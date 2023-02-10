import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { MetricNodeProperties } from 'components/graph/MetricNode'
import { useAuth } from 'contexts/auth'
import { useEditability } from 'contexts/editability'
import { useGraph } from 'contexts/graph'
import { useQueries } from 'contexts/queries'
import {
  QueryData,
  getLatestQueryId,
  parameterizeStatement,
} from 'utils/queryUtils'
import { supabase } from 'utils/supabaseClient'

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
    globalSourceRefreshes,
    setQueriesLoading,
    queriesToCancel,
    setQueriesToCancel,
    inputParameters,
  } = useQueries()
  const [getQueryIdComplete, setGetQueryIdComplete] = useState(false)
  const [parameterizedStatement, setParameterizedStatement] = useState('')
  const [parentPopulated, setParentPopulated] = useState(false)
  const [queryId, setQueryId] = useState('')

  useEffect(() => {
    const statement = parentMetricNodeData?.source?.query
    let _parameterizedStatement = ''
    if (statement) {
      _parameterizedStatement = parameterizeStatement(
        statement,
        inputParameters
      )
    }
    setParameterizedStatement(_parameterizedStatement)
  }, [parentMetricNodeData?.source?.query, inputParameters])

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
          parameterizedStatement,
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
    parameterizedStatement,
    parentMetricNodeData?.source?.databaseConnectionId,
    parentMetricNodeData?.id,
  ])

  useEffect(() => {
    getQueryId()
  }, [getQueryId])

  // listen for new query executions
  useEffect(() => {
    const query = supabase
      .from(`database_queries:parent_node_id=eq.${parentMetricNodeData?.id}`)
      .on('INSERT', (payload) => {
        /* update query id if db connection and statement match; Ideally we'd be able
          to include this in from, but it only supports 1 filter at the moment */
        if (
          payload.new.database_connection_id ===
            parentMetricNodeData?.source?.databaseConnectionId &&
          payload.new.statement === parameterizedStatement
        ) {
          setQueryId(payload.new.id)
        }
      })
      .subscribe()
    return () => {
      query.unsubscribe()
    }
  }, [
    parentMetricNodeData?.id,
    parentMetricNodeData?.source?.databaseConnectionId,
    parameterizedStatement,
  ])

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
                  if (!row[columnIndex]) return
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
          inputParameters
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
    inputParameters,
    setQueryResult,
  ])

  useEffect(() => {
    if (refreshes > 0) {
      executeQuery()
    }
  }, [refreshes, executeQuery])

  useEffect(() => {
    if (globalSourceRefreshes > 0) {
      executeQuery()
    }
  }, [globalSourceRefreshes, executeQuery])

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
