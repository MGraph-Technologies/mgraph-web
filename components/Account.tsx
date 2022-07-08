import React, { FunctionComponent, useEffect, useState } from 'react'
import { Button } from 'primereact/button'
import { useRouter } from 'next/router'

import { supabase } from '../utils/supabaseClient'


type Props = {
}

const Account: FunctionComponent<Props> = () => {
  const router = useRouter()
  const user = supabase.auth.user()

  async function handleSignOut() {
    supabase.auth.signOut()
    router.push('/')
  }

  async function handleUpdatePassword() {
    const { data, error } = await supabase.auth.update({ 
      password: process.env.NEXT_PUBLIC_CYPRESS_TEST_ACCOUNT_PASSWORD }
    )
  }

  return (
    <div className="account-module">
      <div>Signed in as: {user ? user.email : ''}</div>
      <button className="sign-out-button" onClick={() => handleSignOut()}>
        Sign Out
      </button>
      <button className="update-password-button" onClick={() => handleUpdatePassword()}>
        Update Password
      </button>
    </div>
  )
}

export default Account