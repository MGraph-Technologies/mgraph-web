import { FunctionComponent, useCallback, useEffect } from 'react'

import { useAuth } from '../contexts/auth'
import { useGraph } from '../contexts/graph'

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
  const { globalQueryRefreshes } = useGraph()

  const executeQuery = useCallback(async () => {
    const accessToken = session?.access_token
    if (accessToken && databaseConnectionId && parentNodeId && statement) {
      fetch('/api/v1/queries', {
        method: 'POST',
        body: JSON.stringify({
          databaseConnectionId: databaseConnectionId,
          parentNodeId: parentNodeId,
          statement: statement
        }),
        headers: {
          'supabase-access-token': accessToken,
        },
      })
        .then((response) => {
          if (response.status === 200) {
            // TODO: add get query results
          } else {
            throw new Error(response.statusText)
          }
        })
        .catch((error) => {
          alert(error.message)
        })
    }
  }, [databaseConnectionId, parentNodeId, session, statement])
  useEffect(() => {
    executeQuery()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshes, globalQueryRefreshes])

  return <></> // TODO: chart
}

export default QueryRunner
