import React, { FunctionComponent } from 'react'

import AccountMenu from '../components/AccountMenu'

type Props = {}

const ComingSoon: FunctionComponent<Props> = () => {
  return (
    <div>
      <p>
        Thanks for your interest in MGraph! We&#39;ll be in touch as soon as
        it&#39;s available to you.
      </p>
      <AccountMenu />
    </div>
  )
}

export default ComingSoon
