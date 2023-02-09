import Image from 'next/image'
import { Button } from 'primereact/button'
import React, { FunctionComponent, useState } from 'react'

import { supabase } from 'utils/supabaseClient'

const SignInButton: FunctionComponent = () => {
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signIn({
        provider: 'google',
      })
      if (error) throw error
    } catch (error: unknown) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }
  return (
    <div>
      <Button
        id="continue-with-google-button"
        className="p-button-outlined"
        label="Continue with Google"
        icon={
          <>
            <Image
              src="/google_g.svg"
              alt="Google G"
              width={20}
              height={20}
              loading="eager"
            />
            <div style={{ width: '0.5rem' }} />
          </>
        }
        onClick={handleSignIn}
        loading={loading}
      />
    </div>
  )
}

export default SignInButton
