import { createContext, ReactNode, useContext, useState } from 'react'

type EditabilityContextType = {
  editingEnabled: boolean
  enableEditing: () => void
  disableEditing: () => void
}

const editabilityContextDefaultValues: EditabilityContextType = {
  editingEnabled: false,
  enableEditing: () => {},
  disableEditing: () => {},
}

const EditabilityContext = createContext<EditabilityContextType>(
  editabilityContextDefaultValues
)

export function useEditability() {
  return useContext(EditabilityContext)
}

type EditingEnabledProps = {
  children: ReactNode
}

export function EditabilityProvider({ children }: EditingEnabledProps) {
  const [editingEnabled, setEditingEnabled] = useState(false)
  const enableEditing = () => setEditingEnabled(true)
  const disableEditing = () => setEditingEnabled(false)
  const value = { editingEnabled, enableEditing, disableEditing }
  return (
    <>
      <EditabilityContext.Provider value={value}>
        {children}
      </EditabilityContext.Provider>
    </>
  )
}
