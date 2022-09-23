import Head from 'next/head'
import React, { FunctionComponent } from 'react'

import Header from '../components/Header'

type Props = {}

const ComingSoon: FunctionComponent<Props> = () => {
  return (
    <div>
      <Head>
        <title>Coming Soon — MGraph</title>
      </Head>
      <Header />
      <p>
        Thanks for your interest in MGraph! We&#39;ll be in touch as soon as
        it&#39;s available to you.
      </p>
    </div>
  )
}

export default ComingSoon
