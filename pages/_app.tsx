import '@reactflow/node-resizer/dist/style.css'
import moment from 'moment-timezone'
import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import 'primeicons/primeicons.css' //icons
import 'primereact/resources/primereact.min.css' //core css
import 'primereact/resources/themes/lara-light-indigo/theme.css' //theme
import { useEffect, useState } from 'react'
import 'reactflow/dist/style.css'
import { v4 as uuidv4 } from 'uuid'

import { AuthProvider } from 'contexts/auth'
import { BrowserProvider } from 'contexts/browser'
import { EditabilityProvider } from 'contexts/editability'
import { GraphProvider } from 'contexts/graph'
import { QueriesProvider } from 'contexts/queries'
import 'styles/globals.css'
import { analytics } from 'utils/segmentClient'

function MyApp({ Component, pageProps }: AppProps) {
  const [sessionId] = useState<string>(uuidv4())

  // Report page views to segment
  const router = useRouter()
  useEffect(() => {
    // Report initial page views
    analytics.page(router.pathname, {
      session_id: sessionId,
    })
    // Report page views on route change
    const handleRouteChange = (url: string) => {
      analytics.page(url, {
        session_id: sessionId,
      })
    }
    router.events.on('routeChangeStart', handleRouteChange)
    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  })

  // window analytics
  useEffect(() => {
    const interval = setInterval(() => {
      analytics.track('window_pulse', {
        session_id: sessionId,
        visibility: document.visibilityState,
      })
    }, 1000 * 10)
    const handleWindowBlur = () => {
      analytics.track('window_blur', {
        session_id: sessionId,
      })
    }
    const handleWindowFocus = () => {
      analytics.track('window_focus', {
        session_id: sessionId,
      })
    }
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  })

  // don't transform charttimezones
  useEffect(() => {
    moment.tz.setDefault('UTC')
  }, [])

  return (
    <AuthProvider>
      <BrowserProvider>
        <EditabilityProvider>
          <GraphProvider>
            <QueriesProvider>
              <Component {...pageProps} />
            </QueriesProvider>
          </GraphProvider>
        </EditabilityProvider>
      </BrowserProvider>
    </AuthProvider>
  )
}

export default MyApp
