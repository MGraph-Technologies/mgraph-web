import { createContext, ReactNode, useContext, useState } from 'react'

type EditabilityContextType = {
  commentingEnabled: boolean
  enableCommenting: () => void
  disableCommenting: () => void
  editingEnabled: boolean
  enableEditing: () => void
  disableEditing: () => void
}

const editabilityContextDefaultValues: EditabilityContextType = {
  commentingEnabled: false,
  enableCommenting: () => {
    return
  },
  disableCommenting: () => {
    return
  },
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
  const [commentingEnabled, setCommentingEnabled] = useState(false)
  const enableCommenting = () => setCommentingEnabled(true)
  const disableCommenting = () => setCommentingEnabled(false)
  const [editingEnabled, setEditingEnabled] = useState(false)
  const enableEditing = () => setEditingEnabled(true)
  const disableEditing = () => setEditingEnabled(false)
  const value = {
    commentingEnabled,
    enableCommenting,
    disableCommenting,
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
