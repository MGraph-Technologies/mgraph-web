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

  return (
    <div className="account-module">
      <div>Signed in as: {user ? user.email : ''}</div>
      <button className="sign-out-button" onClick={() => handleSignOut()}>
        Sign Out
      </button>
    </div>
  )
}

export default Account