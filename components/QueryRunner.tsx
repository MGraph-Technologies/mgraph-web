import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { useGraph } from '../contexts/graph'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

export type QueryResult = {
  status: 'success' | 'processing' | 'expired' | 'error' | 'empty'
  data: any | null
}

type QueryRunnerProps = {
  statement: string
  databaseConnectionId: string
  parentNodeId: string
  refreshes: number // increment this number to force a refresh
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
  setQueryResult,
}) => {
  const { session } = useAuth()
  const { globalQueryRefreshes, setGlobalQueryRefreshes, queryParameters } =
    useGraph()
  const [queryId, setQueryId] = useState('')
  const [getQueryIdComplete, setGetQueryIdComplete] = useState(false)

  const parameterizeStatement = useCallback(() => {
    return statement.replace(/{{(.*?)}}/g, (_match, p1) => {
      const snakeCaseName = p1.toLowerCase().replace(/ /g, '_')
      if (queryParameters[snakeCaseName]) {
        return queryParameters[snakeCaseName].userValue
      } else {
        return '{{' + p1 + '}}'
      }
    })
  }, [statement, queryParameters])

  const getQueryId = useCallback(async () => {
    if (getQueryIdComplete) {
      return
    }
    const accessToken = session?.access_token
    if (accessToken && databaseConnectionId && parentNodeId && statement) {
      try {
        let { data, error, status } = await supabase
          .from('database_queries')
          .select('id')
          .is('deleted_at', null)
          .match({
            database_connection_id: databaseConnectionId,
            parent_node_id: parentNodeId,
            statement: parameterizeStatement(),
          })
          .order('created_at', { ascending: false })
          .limit(1)

        if (error && status !== 406) {
          throw error
        }

        if (data && data.length > 0) {
          setQueryId(data[0].id)
          setGetQueryIdComplete(true)
        }
      } catch (error: any) {
        console.error(error.message)
      }
    }
  }, [
    getQueryIdComplete,
    session,
    parentNodeId,
    databaseConnectionId,
    statement,
    parameterizeStatement,
  ])
  useEffect(() => {
    getQueryId()
  }, [getQueryId])

  const getQueryResult = useCallback(async () => {
    const accessToken = session?.access_token
    if (accessToken && queryId) {
      fetch('/api/v1/queries/' + queryId + '/results', {
        method: 'GET',
        headers: {
          'supabase-access-token': accessToken,
        },
      })
        .then((response) => {
          analytics.track('got_query_result', {
            query_id: queryId,
            status: response.status,
          })
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
  }, [session, queryId, setQueryResult])

  useEffect(() => {
    getQueryResult()
  }, [getQueryResult])

  const executeQuery = useCallback(async () => {
    const accessToken = session?.access_token
    if (accessToken && parentNodeId && databaseConnectionId) {
      const queryBody = {
        databaseConnectionId: databaseConnectionId,
        parentNodeId: parentNodeId,
        statement: parameterizeStatement(),
      }
      analytics.track('execute_query', queryBody)
      fetch('/api/v1/queries', {
        method: 'POST',
        body: JSON.stringify(queryBody),
        headers: {
          'supabase-access-token': accessToken,
        },
      })
        .then((response) => {
          if (response.status === 200) {
            response.json().then((data) => {
              setGetQueryIdComplete(false)
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
              error: error.message,
            },
          })
        })
    }
  }, [
    session,
    databaseConnectionId,
    parentNodeId,
    parameterizeStatement,
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
