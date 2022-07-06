import React, { FunctionComponent } from 'react'

import Account from '../components/Account'


type Props = {
}

const ComingSoon: FunctionComponent<Props> = () => {
  return (
    <div>
      <p>Thanks for your interest in MGraph! We&#39;ll be in touch as soon as it&#39;s available to you.</p>
      <Account/>
    </div>
  )
}

export default ComingSoon