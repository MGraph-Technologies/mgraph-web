import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import 'primeicons/primeicons.css' //icons
import 'primereact/resources/primereact.min.css' //core css
import 'primereact/resources/themes/lara-light-indigo/theme.css' //theme
import { useEffect } from 'react'
import { EditabilityProvider } from '../contexts/editability'

import '../styles/globals.css'
import { analytics } from '../utils/segmentClient'

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

  return (
    <EditabilityProvider>
      <Component {...pageProps} />
    </EditabilityProvider>
  )
}

export default MyApp
