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
            <div className={styles.sign_in_legal_text}>
              By clicking &quot;Continue with Google&quot; above, you
              acknowledge that you have read and understood, and agree to
              MGraph&apos;s{' '}
              <a
                href="http://www.mgraph.us/terms"
                target="_blank"
                rel="noreferrer"
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="http://www.mgraph.us/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Privacy Policy
              </a>
              .
            </div>
          </div>
        ) : (
          <AuthedUserRouter key={session.user?.id || ''} />
        )}
      </main>

      <footer className={styles.footer}>
        © 2023 MGraph Technologies, Inc.
      </footer>
    </div>
  )
}

export default Home
