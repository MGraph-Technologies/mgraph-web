import { useRouter } from 'next/router'
import React, { FunctionComponent, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type Props = {}

const Account: FunctionComponent<Props> = () => {
  const { session } = useAuth()

  const [userEmail, setUserEmail] = useState('')
  useEffect(() => {
    setUserEmail(session?.user?.email || '')
  }, [session])

  const router = useRouter()
  async function handleSignOut() {
    supabase.auth.signOut()
    analytics.track('logout')
    router.push('/')
  }

  return (
    <div className="account-module">
      <div>{userEmail}</div>
      <button
        id="sign-out-button"
        className="sign-out-button"
        onClick={() => handleSignOut()}
      >
        Sign Out
      </button>
    </div>
  )
}

export default Account
