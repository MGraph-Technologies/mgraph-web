import Image from 'next/image'
import { useRouter } from 'next/router'
import { Button } from 'primereact/button'
import { Menu } from 'primereact/menu'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'

import UserAvatar from 'components/UserAvatar'
import { useAuth } from 'contexts/auth'
import { useBrowser } from 'contexts/browser'
import styles from 'styles/AccountMenu.module.css'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

const AccountMenu: FunctionComponent = () => {
  const {
    session,
    organizationEnabled,
    organizationName,
    organizationIsPersonal,
    organizationLogoStoragePath,
    userAvatarUrl,
    userEmail,
    userName,
    userRole,
    userIsAdmin,
  } = useAuth()
  const { push } = useBrowser()

  const [userDisplayRole, setUserDisplayRole] = useState('')
  useEffect(() => {
    if (organizationIsPersonal) {
      setUserDisplayRole('Personal Account')
    } else {
      setUserDisplayRole(
        userRole.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
      )
    }
  }, [organizationIsPersonal, userRole])

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
      command: () =>
        window.open(
          'https://docs.google.com/document/d/1vLgQMqeKV6cVLzgDLUDxpkXwzDjXnSLsgMDCxY2SxQc/edit?usp=sharing',
          '_blank'
        ),
    })
  }

  const overlayMenu = useRef<Menu>(null)
  const userSettingsSubMenuItems = []
  if (organizationEnabled) {
    userSettingsSubMenuItems.push({
      label: userDisplayRole,
      disabled: true,
    })
  }
  userSettingsSubMenuItems.push({
    label: 'Sign Out',
    icon: 'pi pi-sign-out',
    command: () => handleSignOut(),
  })
  const adminSettingsSubMenuItems = []
  if (!organizationIsPersonal) {
    adminSettingsSubMenuItems.push({
      label: 'Access Management',
      icon: 'pi pi-users',
      command: () =>
        push('/' + organizationName + '/settings/access-management'),
    })
  }
  adminSettingsSubMenuItems.push({
    label: 'Database Connections',
    icon: 'pi pi-database',
    command: () =>
      push('/' + organizationName + '/settings/database-connections'),
  })
  adminSettingsSubMenuItems.push({
    label: 'Graph Syncs',
    icon: 'pi pi-sync',
    command: () => push('/' + organizationName + '/settings/graph-syncs'),
  })
  adminSettingsSubMenuItems.push({
    label: 'Input Parameters',
    icon: 'pi pi-sliders-h',
    command: () => push('/' + organizationName + '/settings/input-parameters'),
  })
  adminSettingsSubMenuItems.push({
    label: 'Refresh Jobs',
    icon: 'pi pi-clock',
    command: () => push('/' + organizationName + '/settings/refresh-jobs'),
  })
  const overlayMenuItems = []
  overlayMenuItems.push({
    label: userEmail,
    items: userSettingsSubMenuItems,
  })
  if (userIsAdmin && organizationEnabled) {
    overlayMenuItems.push({
      label: 'Admin Settings',
      items: adminSettingsSubMenuItems,
    })
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
      <div id="account-menu">
        <UserAvatar
          user={{
            id: session?.user?.id || '',
            name: userName,
            email: userEmail,
            avatarUrl: userAvatarUrl,
          }}
          onClick={(event) => overlayMenu.current?.toggle(event)}
        />
      </div>
    </>
  )
}

export default AccountMenu
