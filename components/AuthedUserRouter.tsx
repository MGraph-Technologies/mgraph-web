import { useRouter } from 'next/router'
import React, { FunctionComponent, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { supabase } from '../utils/supabaseClient'

type Props = {}

const AuthedUserRouter: FunctionComponent<Props> = () => {
  const router = useRouter()
  const { session } = useAuth()

  async function routeToOrganizationIfEnabled() {
    try {
      let { data, error, status } = await supabase
        .from('organizations')
        .select('name, organization_members!inner(*)')
        .eq('enabled', true)
        .is('deleted_at', null)
        .eq('organization_members.user_id', session?.user?.id || '')
        .single()

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        router.push('/' + data.name)
      } else {
        router.push('/coming_soon')
      }
    } catch (error: any) {
      alert(error.message)
    }
  }
  useEffect(() => {
    routeToOrganizationIfEnabled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div>Loading...</div>
}

export default AuthedUserRouter
