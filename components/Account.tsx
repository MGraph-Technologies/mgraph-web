import { useRouter } from 'next/router'
import React, { FunctionComponent, useEffect, useState } from 'react'

import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type Props = {}

const Account: FunctionComponent<Props> = () => {
  const [user_email, setUserEmail] = useState('')

  useEffect(() => {
    populateAccount()
  }, [])

  async function populateAccount() {
    try {
      const user = supabase.auth.user()
      if (user && user.email) {
        setUserEmail(user.email)
      }
    } catch (error: any) {
      alert(error.message)
    }
  }

  const router = useRouter()
  async function handleSignOut() {
    supabase.auth.signOut()
    analytics.track('logout')
    router.push('/')
  }

  return (
    <div className="account-module">
      <div>{user_email}</div>
      <button className="sign-out-button" onClick={() => handleSignOut()}>
        Sign Out
      </button>
    </div>
  )
}

export default Account
