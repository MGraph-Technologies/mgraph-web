import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { useGraph } from '../contexts/graph'
import { supabase } from '../utils/supabaseClient'

type QueryRunnerProps = {
  statement: string
  databaseConnectionId: string
  parentNodeId: string,
  refreshes: number // increment this number to force a refresh
}
const QueryRunner: FunctionComponent<QueryRunnerProps> = ({ 
  statement,
  databaseConnectionId,
  parentNodeId,
  refreshes
}) => {
  const { session } = useAuth()
  const { globalQueryRefreshes, queryParameters } = useGraph()
  const [queryId, setQueryId] = useState('')
  const [getQueryIdComplete, setGetQueryIdComplete] = useState(false)
  type QueryResult = {
    status: 'success' | 'processing' | 'expired' | 'error',
    data: object | null,
  }
  const [queryResult, setQueryResult] = useState<QueryResult>({ 
    status: 'processing',
    data: null
  })

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
        alert(error.message)
      }
    }
  }, [getQueryIdComplete, session, parentNodeId, databaseConnectionId, statement, parameterizeStatement])
  useEffect(() => {
    getQueryId()
  }, [getQueryId])

  const checkColumnsStructure = (columns: any) => {
    const snowflakeDateTypes = [
      'DATE', 'TIMESTAMP', 'TIMESTAMP_NTZ', 'TIMESTAMP_LTZ', 'TIMESTAMP_TZ'
    ]
    const snowflakeStringTypes = [
      'CHAR', 'CHARACTER', 'STRING', 'TEXT', 'VARCHAR'
    ]
    const snowflakeNumberTypes = [
      'DECIMAL', 'DOUBLE', 'DOUBLE PRECISION', 'FIXED', 'FLOAT', 'FLOAT4', 'FLOAT8', 'INTEGER',
      'NUMBER', 'NUMERIC', 'REAL'
    ]
    return (
      columns && 
      columns.length === 3 &&
      snowflakeDateTypes.includes(columns[0].type.toUpperCase()) &&
      snowflakeStringTypes.includes(columns[1].type.toUpperCase()) &&
      snowflakeNumberTypes.includes(columns[2].type.toUpperCase())
    )
  }
  
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
          if (response.status === 200) {
            response.json().then((data) => {
              const columns = data.columns
              const rows = data.rows
              if (checkColumnsStructure(columns) && rows) {
                setQueryResult({
                  status: 'success',
                  data: {
                    rows: rows,
                    columns: columns
                  }
                })
              } else {
                setQueryResult({
                  status: 'error',
                  data: {
                    error: 'Invalid query result structure',
                  },
                })
              }
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
          alert(error.message)
        })
    }
  }, [session, queryId])

  useEffect(() => {
    getQueryResult()
  }, [getQueryResult])

  const executeQuery = useCallback(async () => {
    const accessToken = session?.access_token
    if (accessToken && parentNodeId && databaseConnectionId) {
      fetch('/api/v1/queries', {
        method: 'POST',
        body: JSON.stringify({
          databaseConnectionId: databaseConnectionId,
          parentNodeId: parentNodeId,
          statement: parameterizeStatement(),
        }),
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
  }, [session, databaseConnectionId, parentNodeId, parameterizeStatement])

  useEffect(() => {
    executeQuery()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshes, globalQueryRefreshes])

  if (!statement) {
    return <>Please add a query.</> // TODO: render the empty state
  } else if (queryResult.status === 'success') {
    return <>Success!</>
  } else if (queryResult.status === 'processing') {
    return <>Processing...</> // TODO: render the running indicator
  } else if (queryResult.status === 'expired') {
    return <>Expired...</> // TODO: render the expired indicator
  } else {
    return <>Error...</> // TODO: render the error indicator
  }
}

export default QueryRunner
