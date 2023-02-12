import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useEffect,
  useState,
  useContext,
} from 'react'
import { v5 as uuidv5 } from 'uuid'

import { useAuth } from 'contexts/auth'
import { InputParameters, getInputParameters } from 'utils/queryUtils'
import { supabase } from 'utils/supabaseClient'

type QueryHash = string
type QueryId = string
type QueryHashGenerator = (
  databaseConnectionId: string,
  parentNodeId: string,
  statement: string
) => QueryHash
type QueryIdMap = { [hash: QueryHash]: QueryId }

type QueriesContextType = {
  globalSourceRefreshes: number
  setGlobalSourceRefreshes: Dispatch<SetStateAction<number>> | undefined
  queriesLoading: Array<string>
  /* ^would prefer to use a Set here, but that doesn't work with useState
    https://stackoverflow.com/questions/58806883/how-to-use-set-with-reacts-usestate */
  setQueriesLoading: Dispatch<SetStateAction<Array<string>>> | undefined
  latestQueryIds: QueryIdMap
  setLatestQueryIds: Dispatch<SetStateAction<QueryIdMap>> | undefined
  generateQueryHash: QueryHashGenerator | undefined
  queriesToCancel: Array<string>
  setQueriesToCancel: Dispatch<SetStateAction<Array<string>>> | undefined
  inputParameters: InputParameters
  setInputParameters: Dispatch<SetStateAction<InputParameters>> | undefined
  resetInputParameterUserValue: ((name: string) => Promise<void>) | undefined
  setInputParameterUserValue:
    | ((name: string, value: string) => Promise<void>)
    | undefined
  setInputParameterOrgDefaultValue:
    | ((name: string, value: string) => Promise<void>)
    | undefined
}

const queriesContextDefaultValues: QueriesContextType = {
  globalSourceRefreshes: 0,
  setGlobalSourceRefreshes: undefined,
  queriesLoading: [] as string[],
  setQueriesLoading: undefined,
  latestQueryIds: {},
  setLatestQueryIds: undefined,
  generateQueryHash: undefined,
  queriesToCancel: [] as string[],
  setQueriesToCancel: undefined,
  inputParameters: {},
  setInputParameters: undefined,
  resetInputParameterUserValue: undefined,
  setInputParameterUserValue: undefined,
  setInputParameterOrgDefaultValue: undefined,
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

  const [globalSourceRefreshes, setGlobalSourceRefreshes] = useState(0)
  const [queriesLoading, setQueriesLoading] = useState([] as string[])
  const [latestQueryIds, setLatestQueryIds] = useState<QueryIdMap>({})
  const [queriesToCancel, setQueriesToCancel] = useState([] as string[])
  const [inputParameters, setInputParameters] = useState<InputParameters>({})

  useEffect(() => {
    // reset globalSourceRefreshes to 0 once queriesLoading is empty
    if (globalSourceRefreshes > 0 && queriesLoading.length === 0) {
      setGlobalSourceRefreshes(0)
    }
  }, [globalSourceRefreshes, queriesLoading])

  const generateQueryHash: QueryHashGenerator = (
    databaseConnectionId,
    parentNodeId,
    statement
  ) => {
    return uuidv5(
      `${databaseConnectionId}-${parentNodeId}-${statement}`,
      uuidv5.DNS
    )
  }

  // listen for query executions and keep map updated
  useEffect(() => {
    const subscription = supabase
      .from('database_queries')
      .on('INSERT', (payload) => {
        const newQuery = payload.new
        if (newQuery) {
          const queryHash = generateQueryHash(
            newQuery.database_connection_id,
            newQuery.parent_node_id,
            newQuery.statement
          )
          const queryId = newQuery.id
          setLatestQueryIds((prev) => ({
            ...prev,
            [queryHash]: queryId,
          }))
        }
      })
      .subscribe()
    return () => {
      supabase.removeSubscription(subscription)
    }
  }, [])

  const populateInputParameters = useCallback(async () => {
    if (organizationId && session?.user?.id) {
      const inputParameters = await getInputParameters(
        organizationId,
        supabase,
        session.user.id
      )
      setInputParameters(inputParameters)
    }
  }, [organizationId, session?.user?.id])
  useEffect(() => {
    populateInputParameters()
  }, [populateInputParameters])

  const resetInputParameterUserValue = useCallback(
    async (name: string) => {
      let ip = inputParameters[name]
      if (ip) {
        try {
          await supabase
            .from('input_parameters')
            .upsert({
              id: ip.userRecordId,
              organization_id: organizationId,
              user_id: session?.user?.id,
              name: name,
              value: ip.userValue,
              updated_at: new Date(),
              deleted_at: new Date(),
            })
            .then(() => {
              ip = {
                ...ip,
                userValue: ip.orgDefaultValue,
              }
              setInputParameters((prev) => ({
                ...prev,
                [name]: ip,
              }))
            })
        } catch (error: unknown) {
          console.error(error)
        }
      }
    },
    [inputParameters, organizationId, session]
  )

  const setInputParameterUserValue = useCallback(
    async (name: string, value: string) => {
      let ip = inputParameters[name]
      if (ip) {
        if (value === ip.orgDefaultValue) {
          resetInputParameterUserValue(name)
        } else {
          try {
            await supabase
              .from('input_parameters')
              .upsert({
                id: ip.userRecordId,
                organization_id: organizationId,
                user_id: session?.user?.id,
                name: name,
                value: value,
                updated_at: new Date(),
                deleted_at: null,
              })
              .then(() => {
                ip = {
                  ...ip,
                  userValue: value,
                }
                setInputParameters((prev) => ({
                  ...prev,
                  [name]: ip,
                }))
              })
          } catch (error: unknown) {
            console.error(error)
          }
        }
      }
    },
    [inputParameters, resetInputParameterUserValue, organizationId, session]
  )

  const setInputParameterOrgDefaultValue = useCallback(
    async (name: string, value: string) => {
      let ip = inputParameters[name]
      if (ip) {
        try {
          await supabase
            .from('input_parameters')
            .upsert([
              {
                id: ip.orgDefaultRecordId,
                organization_id: organizationId,
                user_id: null,
                name: name,
                value: value,
                updated_at: new Date(),
                deleted_at: null,
              },
              {
                id: ip.userRecordId,
                organization_id: organizationId,
                user_id: session?.user?.id,
                name: name,
                value: ip.userValue,
                updated_at: new Date(),
                deleted_at: new Date(),
              },
            ])
            .then(() => {
              ip = {
                ...ip,
                orgDefaultValue: value,
                userValue: value,
              }
              setInputParameters((prev) => ({
                ...prev,
                [name]: ip,
              }))
            })
        } catch (error: unknown) {
          console.error(error)
        }
      }
    },
    [inputParameters, organizationId, session]
  )

  const value = {
    globalSourceRefreshes: globalSourceRefreshes,
    setGlobalSourceRefreshes: setGlobalSourceRefreshes,
    queriesLoading: queriesLoading,
    setQueriesLoading: setQueriesLoading,
    latestQueryIds: latestQueryIds,
    setLatestQueryIds: setLatestQueryIds,
    generateQueryHash: generateQueryHash,
    queriesToCancel: queriesToCancel,
    setQueriesToCancel: setQueriesToCancel,
    inputParameters: inputParameters,
    setInputParameters: setInputParameters,
    resetInputParameterUserValue: resetInputParameterUserValue,
    setInputParameterUserValue: setInputParameterUserValue,
    setInputParameterOrgDefaultValue: setInputParameterOrgDefaultValue,
  }
  return (
    <>
      <QueriesContext.Provider value={value}>
        {children}
      </QueriesContext.Provider>
    </>
  )
}
