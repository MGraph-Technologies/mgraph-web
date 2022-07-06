import Head from 'next/head'
import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import type { NextPage } from 'next'

import AuthedUserRouter from '../components/AuthedUserRouter'
import SignInButton from '../components/SignInButton'
import styles from '../styles/Home.module.css'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'


const Home: NextPage = () => {
  const [session, setSession] = useState<Session | null>()

  useEffect(() => {
    setSession(supabase.auth.session())

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if( session && session.user ) {
        analytics.identify(session.user.id)
      }
      
    })
  }, [])
  
  return (
    <div className={styles.container}>
      <Head>
        <title>MGraph: How and Why Your Organization is Performing</title>
        <meta name="description" content="MGraph is a comprehensive, realtime view of how and why you organization is performing" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to MGraph!
        </h1>
        <div className="container" style={{ padding: '50px 0 100px 0' }}>
          {!session ? <SignInButton /> : <AuthedUserRouter key={session.user ? session.user.id : ''} />}
        </div>
      </main>

      <footer className={styles.footer}>
      © 2022 MGraph Technologies, Inc.
      </footer>
    </div>
  )
}

export default Home
