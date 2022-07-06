import React, { FunctionComponent } from 'react'
import { useRouter } from 'next/router'

import Account from '../components/Account'


type Props = {
}

const MGraph: FunctionComponent<Props> = () => {
  const router = useRouter()
  const { organization_name } = router.query

  return (
    <div>
      <p>This is a place for {organization_name}&#39;s MGraph.</p>
      <Account/>
    </div>
  )
}

export default MGraph