import type { NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>MGraph: How and Why Your Organization is Performing</title>
        <meta name="description" content="MGraph is a comprehensive, realtime view of how and why you organization is performing" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Coming soon!
        </h1>
      </main>

      <footer className={styles.footer}>
      © 2022 MGraph Technologies, Inc.
      </footer>
    </div>
  )
}

export default Home
