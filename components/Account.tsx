import React, { FunctionComponent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { supabase } from '../utils/supabaseClient'


type Props = {
}

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
    router.push('/')
  }

  return (
    <div className="account-module">
      <p>Signed in as: {user_email}</p>
      <button className="sign-out-button" onClick={() => handleSignOut()}>
        Sign Out
      </button>
    </div>
  )
}

export default Account