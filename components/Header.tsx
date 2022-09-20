import Image from 'next/image'
import Link from 'next/link'
import { FunctionComponent } from 'react'

import styles from '../styles/Header.module.css'
import AccountMenu from './AccountMenu'

type HeaderProps = {}
const Header: FunctionComponent<HeaderProps> = () => {
  return (
    <div className={styles.header}>
      <div className={styles.mgraph_logo_container}>
        <Link href="/">
          <Image
            src="/mgraph_logo.svg"
            alt="mgraph logo"
            height={50}
            width={150}
          />
        </Link>
      </div>
      <div className={styles.account_menu_container}>
        <AccountMenu />
      </div>
    </div>
  )
}

export default Header
