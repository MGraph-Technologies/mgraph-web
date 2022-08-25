import Link from 'next/link'
import { FunctionComponent } from 'react'

import AccountMenu from './AccountMenu'
import styles from '../styles/Header.module.css'

type HeaderProps = {}
const Header: FunctionComponent<HeaderProps> = () => {
  return (
    <div className={styles.header}>
      <div className={styles.mgraph_logo_container}>
        <h1>
          <Link href="/">MGraph</Link>
        </h1>
      </div>
      <div className={styles.account_menu_container}>
        <AccountMenu />
      </div>
    </div>
  )
}

export default Header
