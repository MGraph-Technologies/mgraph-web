import router from 'next/router'
import {
  createContext,
  ReactNode,
  useEffect,
  useContext,
  useState,
  useCallback,
} from 'react'

type BrowserContextType = {
  actionKey: string
  actionKeyPressed: boolean
  altKeyPressed: boolean
  shiftKeyPressed: boolean
  inputInProgress: boolean
  push: (path: string) => void
}

const browserContextDefaultValues: BrowserContextType = {
  actionKey: 'Meta',
  actionKeyPressed: false,
  altKeyPressed: false,
  shiftKeyPressed: false,
  inputInProgress: false,
  push: (path: string) => router.push(path),
}

const BrowserContext = createContext<BrowserContextType>(
  browserContextDefaultValues
)

export function useBrowser() {
  return useContext(BrowserContext)
}

type BrowserProps = {
  children: ReactNode
}

export function BrowserProvider({ children }: BrowserProps) {
  // determine action key based on OS
  const [actionKey, setActionKey] = useState('Meta')
  useEffect(() => {
    setActionKey(navigator.platform.match(/Mac/i) ? 'Meta' : 'Control')
  }, [])
  const [actionKeyPressed, setActionKeyPressed] = useState(false)
  const [altKeyPressed, setAltKeyPressed] = useState(false)
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false)
  const [inputInProgress, setInputInProgress] = useState(false)

  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(true)
      } else if (e.key === 'Alt') {
        setAltKeyPressed(true)
      } else if (e.key === 'Shift') {
        setShiftKeyPressed(true)
      }
    }
    document.addEventListener('keydown', keyDownHandler)
    // clean up
    return () => {
      document.removeEventListener('keydown', keyDownHandler)
    }
  }, [actionKey])

  useEffect(() => {
    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(false)
      } else if (e.key === 'Alt') {
        setAltKeyPressed(false)
      } else if (e.key === 'Shift') {
        setShiftKeyPressed(false)
      }
    }
    document.addEventListener('keyup', keyUpHandler)
    // clean up
    return () => {
      document.removeEventListener('keyup', keyUpHandler)
    }
  }, [actionKey])

  useEffect(() => {
    const inputHandler = (e: Event) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.className.includes('ProseMirror tiptap-editor')
      ) {
        if (e.type === 'focusin') {
          setInputInProgress(true)
        } else if (e.type === 'focusout') {
          setInputInProgress(false)
        }
      }
    }
    document.addEventListener('focusin', inputHandler)
    document.addEventListener('focusout', inputHandler)
    // clean up
    return () => {
      document.removeEventListener('focusin', inputHandler)
      document.removeEventListener('focusout', inputHandler)
    }
  }, [])

  // avoid keyup detection failure after user action-tab switches windows
  useEffect(() => {
    const mouseMoveHandler = (e: MouseEvent) => {
      if (actionKey === 'Meta') {
        setActionKeyPressed(e.metaKey)
      } else if (actionKey === 'Control') {
        setActionKeyPressed(e.ctrlKey)
      }
      setAltKeyPressed(e.altKey)
      setShiftKeyPressed(e.shiftKey)
    }
    document.addEventListener('mousemove', mouseMoveHandler)
    // clean up
    return () => {
      document.removeEventListener('mousemove', mouseMoveHandler)
    }
  }, [actionKey])

  // this feels like a util, but AFAICT it's not possible to use context in a util
  // so I'm putting it here for now
  const push = useCallback(
    (path: string) => {
      if (actionKeyPressed || shiftKeyPressed) {
        window.open(path, '_blank')
      } else {
        router.push(path)
      }
    },
    [actionKeyPressed, shiftKeyPressed]
  )

  const value = {
    actionKey,
    actionKeyPressed,
    altKeyPressed,
    shiftKeyPressed,
    inputInProgress,
    push,
  }
  return (
    <>
      <BrowserContext.Provider value={value}>
        {children}
      </BrowserContext.Provider>
    </>
  )
}
