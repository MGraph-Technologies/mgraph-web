import type { NextPage } from 'next'
import Head from 'next/head'

import AuthedUserRouter from '../components/AuthedUserRouter'
import SignInButton from '../components/SignInButton'
import { useAuth } from '../contexts/auth'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  const { session } = useAuth()

  return (
    <div className={styles.container}>
      <Head>
        <title>MGraph: How and Why Your Organization is Performing</title>
        <meta
          name="description"
          content="MGraph is a comprehensive, realtime view of how and why you organization is performing"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>Welcome to MGraph!</h1>
        <div className="container" style={{ padding: '50px 0 100px 0' }}>
          {!session ? (
            <SignInButton />
          ) : (
            <AuthedUserRouter key={session.user?.id || ''} />
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        © 2022 MGraph Technologies, Inc.
      </footer>
    </div>
  )
}

export default Home
