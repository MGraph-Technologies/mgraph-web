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
        Thanks for your interest in MGraph — you&#39;ve been added to our
        waitlist and we&#39;ll be in touch soon!
      </p>
    </div>
  )
}

export default ComingSoon
