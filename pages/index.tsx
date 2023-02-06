import Image from 'next/image'
import type { NextPage } from 'next'
import Head from 'next/head'

import AuthedUserRouter from 'components/AuthedUserRouter'
import SignInButton from 'components/SignInButton'
import { useAuth } from 'contexts/auth'
import styles from 'styles/Home.module.css'

const Home: NextPage = () => {
  const { session } = useAuth()

  return (
    <div className={styles.container}>
      <Head>
        <title>MGraph</title>
      </Head>

      <main className={styles.main}>
        <Image src="/logo.svg" alt="MGraph Logo" height={200} width={600} />
        <div className="container" style={{ padding: '0 0 4rem 0' }}>
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
