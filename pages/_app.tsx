import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import 'primeicons/primeicons.css' //icons
import 'primereact/resources/primereact.min.css' //core css
import 'primereact/resources/themes/lara-light-indigo/theme.css' //theme
import { useEffect } from 'react'

import { AuthProvider, useAuth } from '../contexts/auth'
import { EditabilityProvider } from '../contexts/editability'
import { GraphProvider } from '../contexts/graph'
import '../styles/globals.css'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

function MyApp({ Component, pageProps }: AppProps) {
  // Report page views to segment
  const router = useRouter()
  useEffect(() => {
    // Report initial page views
    analytics.page(router.pathname)
    // Report page views on route change
    const handleRouteChange = (url: string) => {
      analytics.page(url)
    }
    router.events.on('routeChangeStart', handleRouteChange)
  })

  useEffect(() => {
    const interval = setInterval(() => {
      analytics.track('window_pulse', {
        visibility: document.visibilityState,
      })
    }, 1000 * 10)
    const handleWindowBlur = () => {
      analytics.track('window_blur')
    }
    const handleWindowFocus = () => {
      analytics.track('window_focus')
    }
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
    }
  })

  return (
    <AuthProvider>
      <GraphProvider>
        <EditabilityProvider>
          <Component {...pageProps} />
        </EditabilityProvider>
      </GraphProvider>
    </AuthProvider>
  )
}

export default MyApp
