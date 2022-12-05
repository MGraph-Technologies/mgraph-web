import { createContext, ReactNode, useContext, useState } from 'react'

type EditabilityContextType = {
  editingEnabled: boolean
  enableEditing: () => void
  disableEditing: () => void
}

const editabilityContextDefaultValues: EditabilityContextType = {
  editingEnabled: false,
  enableEditing: () => {
    return
  },
  disableEditing: () => {
    return
  },
}

const EditabilityContext = createContext<EditabilityContextType>(
  editabilityContextDefaultValues
)

export function useEditability() {
  return useContext(EditabilityContext)
}

type EditabilityProps = {
  children: ReactNode
}

export function EditabilityProvider({ children }: EditabilityProps) {
  const [editingEnabled, setEditingEnabled] = useState(false)
  const enableEditing = () => setEditingEnabled(true)
  const disableEditing = () => setEditingEnabled(false)
  const value = {
    editingEnabled,
    enableEditing,
    disableEditing,
  }
  return (
    <>
      <EditabilityContext.Provider value={value}>
        {children}
      </EditabilityContext.Provider>
    </>
  )
}
