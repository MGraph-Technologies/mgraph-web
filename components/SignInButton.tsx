import { Button } from 'primereact/button'
import React, { FunctionComponent, useState } from 'react'

import { supabase } from '../utils/supabaseClient'

type Props = {}

const SignInButton: FunctionComponent<Props> = () => {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    try {
      setLoading(true)
      let { error } = await supabase.auth.signIn({
        provider: 'google',
      })
      if (error) throw error
    } catch (error: any) {
      alert(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button
        id="sign-in-button"
        className="sign-in-with-google-button"
        label="Sign in with Google"
        icon="pi pi-google"
        onClick={handleSignIn}
        loading={loading}
      />
    </div>
  )
}

export default SignInButton
