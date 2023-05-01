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
        <Image src="/logo.svg" alt="MGraph Logo" height={160} width={600} />
        {!session ? (
          <div className={styles.sign_in_module}>
            <SignInButton />
          </div>
        ) : (
          <AuthedUserRouter key={session.user?.id || ''} />
        )}
      </main>
    </div>
  )
}

export default Home
