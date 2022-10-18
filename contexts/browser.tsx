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
  shiftKeyPressed: boolean
  push: (path: string) => void
}

const browserContextDefaultValues: BrowserContextType = {
  actionKey: 'Meta',
  actionKeyPressed: false,
  shiftKeyPressed: false,
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
  const [shiftKeyPressed, setShiftKeyPressed] = useState(false)

  useEffect(() => {
    const keyDownHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(true)
      } else if (e.key === 'Shift') {
        setShiftKeyPressed(true)
      }
    }
    document.addEventListener('keydown', keyDownHandler)
    // clean up
    return () => {
      document.removeEventListener('keydown', keyDownHandler)
    }
  }, [actionKey, actionKeyPressed])

  useEffect(() => {
    const keyUpHandler = (e: KeyboardEvent) => {
      if (e.key === actionKey) {
        setActionKeyPressed(false)
      } else if (e.key === 'Shift') {
        setShiftKeyPressed(false)
      }
    }
    document.addEventListener('keyup', keyUpHandler)
    // clean up
    return () => {
      document.removeEventListener('keyup', keyUpHandler)
    }
  }, [actionKey, actionKeyPressed])

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

  const value = { actionKey, actionKeyPressed, shiftKeyPressed, push }
  return (
    <>
      <BrowserContext.Provider value={value}>
        {children}
      </BrowserContext.Provider>
    </>
  )
}
