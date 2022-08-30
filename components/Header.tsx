import Link from 'next/link'
import { FunctionComponent } from 'react'

import styles from '../styles/Header.module.css'
import AccountMenu from './AccountMenu'

type HeaderProps = {}
const Header: FunctionComponent<HeaderProps> = () => {
  return (
    <div className={styles.header}>
      <div id="mgraph-logo-container" className={styles.mgraph_logo_container}>
        <h1>
          <Link href="/">MGraph</Link>
        </h1>
      </div>
      <div
        id="account-menu-container"
        className={styles.account_menu_container}
      >
        <AccountMenu />
      </div>
    </div>
  )
}

export default Header
