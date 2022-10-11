import Image from 'next/image'
import { useRouter } from 'next/router'
import { Avatar } from 'primereact/avatar'
import { Menu } from 'primereact/menu'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'

import { useAuth } from '../contexts/auth'
import styles from '../styles/AccountMenu.module.css'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

type Props = {}

const AccountMenu: FunctionComponent<Props> = () => {
  const {
    session,
    organizationName,
    organizationLogoStoragePath,
    userIsAdmin,
  } = useAuth()

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
  let overlayMenuItems = []
  overlayMenuItems = [
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
  if (userIsAdmin) {
    overlayMenuItems = [
      ...overlayMenuItems,
      {
        label: 'Admin Settings',
        items: [
          {
            label: 'Access Management',
            icon: 'pi pi-users',
            command: () =>
              router.push(
                '/' + organizationName + '/settings/access-management'
              ),
          },
          {
            label: 'Database Connections',
            icon: 'pi pi-database',
            command: () =>
              router.push(
                '/' + organizationName + '/settings/database-connections'
              ),
          },
          {
            label: 'Refresh Jobs',
            icon: 'pi pi-clock',
            command: () =>
              router.push(
                '/' + organizationName + '/settings/refresh-jobs'
              ),
          },
        ],
      },
    ]
  }

  return (
    <>
      {organizationLogoStoragePath ? (
        // if org logo is available, we'll show that in Header
        // and show powered by MGraph here
        <>
          <Image
            src="/powered_by_mgraph.svg"
            alt="Powered by MGraph"
            height={50}
            width={150}
            onClick={() => router.push('/')}
          />
          <div className={styles.vertical_line} />
        </>
      ) : null}
      <Menu model={overlayMenuItems} popup ref={overlayMenu} />
      <Avatar
        label={avatarChar}
        onClick={(event) => overlayMenu.current?.toggle(event)}
      />
    </>
  )
}

export default AccountMenu
