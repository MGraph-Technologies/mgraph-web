import React, { FunctionComponent, useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'

import { supabase } from '../utils/supabaseClient'


type Props = {
  session: Session
}

const Account: FunctionComponent<Props> = ({ session }) => {
  useEffect(() => {
    getProfile()
  }, [session])

  async function getProfile() {
    const user = supabase.auth.user()
  }

  return (
    <div className="form-widget">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="text" value={session.user ? session.user.email : ''} disabled />
      </div>

      <div>
        <button className="button block" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default Account;