import { useRouter } from 'next/router'
import { Avatar } from 'primereact/avatar'
import { Menu } from 'primereact/menu'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type Props = {}

const AccountMenu: FunctionComponent<Props> = () => {
  const { session } = useAuth()

  const [userEmail, setUserEmail] = useState('')
  const [avatarChar, setAvatarChar] = useState('')
  useEffect(() => {
    setUserEmail(session?.user?.email || '')
  }, [session])
  useEffect(() => {
    setAvatarChar(userEmail?.charAt(0).toUpperCase() || '')
  }, [userEmail])

  const router = useRouter()
  async function handleSignOut() {
    supabase.auth.signOut()
    analytics.track('logout')
    router.push('/')
  }

  const overlayMenu = useRef<Menu>(null)
  const overlayMenuItems = [
    {
      label: userEmail,
      items: [
        {
          label: 'Sign Out',
          icon: 'pi pi-sign-out',
          command: () => handleSignOut(),
        },
      ],
    },
  ]

  return (
    <>
      <Menu model={overlayMenuItems} popup ref={overlayMenu} />
      <Avatar label={avatarChar} onClick={(event) => overlayMenu.current?.toggle(event)}/>
    </>
  )
}

export default AccountMenu
