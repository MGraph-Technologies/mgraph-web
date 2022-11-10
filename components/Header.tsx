import Image from 'next/image'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../contexts/auth'
import { useBrowser } from '../contexts/browser'
import styles from '../styles/Header.module.css'
import { storagePathToSignedUrl } from '../utils/supabaseClient'
import AccountMenu from './AccountMenu'

const Header: FunctionComponent = () => {
  const { organizationLogoStoragePath } = useAuth()
  const { push } = useBrowser()
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
      } catch (error: unknown) {
        console.error(error)
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
          onClick={() => push('/')}
        />
      </div>
      <div className={styles.account_menu_container}>
        <AccountMenu />
      </div>
    </div>
  )
}

export default Header
