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

import { QueryParameters, getQueryParameters } from '../utils/queryUtils'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './auth'

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
