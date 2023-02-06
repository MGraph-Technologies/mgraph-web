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

import { useAuth } from 'contexts/auth'
import { InputParameters, getInputParameters } from 'utils/queryUtils'
import { supabase } from 'utils/supabaseClient'

type QueriesContextType = {
  globalQueryRefreshes: number
  setGlobalQueryRefreshes: Dispatch<SetStateAction<number>> | undefined
  queriesLoading: Array<string>
  /* ^would prefer to use a Set here, but that doesn't work with useState
    https://stackoverflow.com/questions/58806883/how-to-use-set-with-reacts-usestate */
  setQueriesLoading: Dispatch<SetStateAction<Array<string>>> | undefined
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
  globalQueryRefreshes: 0,
  setGlobalQueryRefreshes: undefined,
  queriesLoading: [] as string[],
  setQueriesLoading: undefined,
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

  const [globalQueryRefreshes, setGlobalQueryRefreshes] = useState(0)
  const [queriesLoading, setQueriesLoading] = useState([] as string[])
  const [queriesToCancel, setQueriesToCancel] = useState([] as string[])

  const [inputParameters, setInputParameters] = useState<InputParameters>({})

  const populateInputParameters = useCallback(async () => {
    if (organizationId && session?.user) {
      const inputParameters = await getInputParameters(
        organizationId,
        supabase,
        session.user.id
      )
      setInputParameters(inputParameters)
    }
  }, [organizationId, session])
  useEffect(() => {
    populateInputParameters()
  }, [populateInputParameters])

  const resetInputParameterUserValue = useCallback(
    async (name: string) => {
      let ip = inputParameters[name]
      if (ip) {
        try {
          await supabase
            .from('database_input_parameters')
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
              .from('database_input_parameters')
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
            .from('database_input_parameters')
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
    globalQueryRefreshes: globalQueryRefreshes,
    setGlobalQueryRefreshes: setGlobalQueryRefreshes,
    queriesLoading: queriesLoading,
    setQueriesLoading: setQueriesLoading,
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
