import React, { FunctionComponent, useState } from 'react'
import { Button } from 'primereact/button'

import { supabase } from '../utils/supabaseClient'


type Props = {}

const SignInButton: FunctionComponent<Props> = () => {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signIn({ 
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