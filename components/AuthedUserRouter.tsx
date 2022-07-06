import React, { FunctionComponent, useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { supabase } from '../utils/supabaseClient'


type Props = {
}

const AuthedUserRouter: FunctionComponent<Props> = () => {
  const router = useRouter()

  useEffect(() => {
    getOrganization()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function getOrganization() {
    try {
      const user = supabase.auth.user()

      let { data, error, status } = await supabase
        .from('organizations')
        .select('name, organization_members!inner(*)')
        .eq('enabled', true)
        .is('deleted_at', null)
        .eq('organization_members.user_id', user ? user.id : '')
        .single()
      
      if (error && status !== 406) {
        throw error
      }

      if (data) {
        router.push('/'+data.name)
      } else {
        router.push('/coming_soon')
      }
    } catch (error: any) {
      alert(error.message)
    } 
  }

  return (
    <div>
      Loading...
    </div>
  )
}

export default AuthedUserRouter;