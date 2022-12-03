import Image from 'next/image'
import { useRouter } from 'next/router'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { Menu } from 'primereact/menu'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { useBrowser } from '../contexts/browser'
import styles from '../styles/AccountMenu.module.css'
import { analytics } from '../utils/segmentClient'
import { supabase } from '../utils/supabaseClient'

const AccountMenu: FunctionComponent = () => {
  const {
    session,
    organizationEnabled,
    organizationName,
    organizationLogoStoragePath,
    userIsAdmin,
  } = useAuth()
  const { push } = useBrowser()

  const [userEmail, setUserEmail] = useState('')
  const [avatarChar, setAvatarChar] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  useEffect(() => {
    setUserEmail(session?.user?.email || '')
  }, [session])
  useEffect(() => {
    setAvatarChar(userEmail?.charAt(0).toUpperCase() || '')
  }, [userEmail])
  useEffect(() => {
    const fetchAvatarUrl = async () => {
      const { data, error } = await supabase
        .from('sce_display_users')
        .select('avatar')
        .eq('id', session?.user?.id)
        .single()

      if (error) {
        console.error(error)
      } else if (data) {
        setAvatarUrl(data.avatar)
      }
    }
    fetchAvatarUrl()
  }, [session])

  const router = useRouter()
  async function handleSignOut() {
    supabase.auth.signOut()
    analytics.track('logout')
    router.push('/')
  }

  const helpMenu = useRef<Menu>(null)
  let helpMenuItems = []
  helpMenuItems = [
    {
      label: 'Contact Us',
      icon: 'pi pi-envelope',
      command: () => window.open('mailto:support@mgraph.us'),
    },
  ]
  if (organizationEnabled) {
    helpMenuItems.push({
      label: 'Runbook',
      icon: 'pi pi-fw pi-book',
      command: () => window.open('https://runbook.mgraph.us', '_blank'),
    })
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
              push('/' + organizationName + '/settings/access-management'),
          },
          {
            label: 'Database Connections',
            icon: 'pi pi-database',
            command: () =>
              push('/' + organizationName + '/settings/database-connections'),
          },
          {
            label: 'Graph Syncs',
            icon: 'pi pi-sync',
            command: () =>
              push('/' + organizationName + '/settings/graph-syncs'),
          },
          {
            label: 'Refresh Jobs',
            icon: 'pi pi-clock',
            command: () =>
              push('/' + organizationName + '/settings/refresh-jobs'),
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
            onClick={() => push('/')}
          />
          <div className={styles.vertical_line} />
        </>
      ) : null}
      <Menu model={helpMenuItems} popup ref={helpMenu} />
      <Button
        id="help-menu"
        className="p-button-rounded p-button-small p-button-text"
        icon="pi pi-question-circle"
        onClick={(event) => helpMenu.current?.toggle(event)}
      />
      <Menu model={overlayMenuItems} popup ref={overlayMenu} />
      <Avatar
        id="account-menu"
        label={avatarChar}
        image={avatarUrl ? avatarUrl : undefined}
        shape="circle"
        onClick={(event) => overlayMenu.current?.toggle(event)}
      />
    </>
  )
}

export default AccountMenu
