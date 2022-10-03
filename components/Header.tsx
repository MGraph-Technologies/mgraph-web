import Image from 'next/image'
import router from 'next/router'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import styles from '../styles/Header.module.css'
import { storagePathToSignedUrl } from '../utils/supabaseClient'
import AccountMenu from './AccountMenu'

type HeaderProps = {}
const Header: FunctionComponent<HeaderProps> = () => {
  const { organizationLogoStoragePath } = useAuth()
  const [logoUrl, setLogoUrl] = useState('')
  const [logoAlt, setLogoAlt] = useState('')

  const populateLogoProps = useCallback(async () => {
    if (organizationLogoStoragePath) {
      try {
        const signedUrl = await storagePathToSignedUrl(
          organizationLogoStoragePath
        )
        if (signedUrl) {
          setLogoUrl(signedUrl)
          setLogoAlt('Organization logo')
        }
      } catch (error: any) {
        console.error(error.message)
      }
    } else {
      setLogoUrl('/logo.svg')
      setLogoAlt('MGraph logo')
    }
  }, [organizationLogoStoragePath])
  useEffect(() => {
    populateLogoProps()
  }, [populateLogoProps])
  return (
    <div className={styles.header}>
      <div className={styles.mgraph_logo_container}>
        <Image
          src="logo.svg"
          loader={() => logoUrl}
          alt={logoAlt}
          height={50}
          width={150}
          onClick={() => router.push('/')}
        />
      </div>
      <div className={styles.account_menu_container}>
        <AccountMenu />
      </div>
    </div>
  )
}

export default Header
