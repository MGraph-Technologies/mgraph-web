import React, { FunctionComponent, useState } from 'react'

import { supabase } from '../utils/supabaseClient'


type Props = {}

const Auth: FunctionComponent<Props> = () => {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  const handleLogin = async (email: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signIn({ email })
      alert('Check your email for the login link!')
      if (error) throw error
    } catch (error: any) {
      alert(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="description">Log in or sign up:</p>
      <div>
        <input
          className="inputField"
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <button
          onClick={(e) => {
            e.preventDefault()
            handleLogin(email)
          }}
          className="button block"
          disabled={loading}
        >
          <span>{loading ? 'Loading' : 'Send magic link'}</span>
        </button>
      </div>
    </div>
  )
}

export default Auth