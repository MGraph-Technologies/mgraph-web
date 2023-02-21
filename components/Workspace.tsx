import { useRouter } from 'next/router'
import { ConfirmDialog } from 'primereact/confirmdialog'
import React, { FunctionComponent, ReactNode, useEffect, useState } from 'react'

import Header from 'components/Header'
import { useAuth } from 'contexts/auth'
import styles from 'styles/Workspace.module.css'

type WorkspaceProps = {
  children: ReactNode
}
const Workspace: FunctionComponent<WorkspaceProps> = ({ children }) => {
  const router = useRouter()
  const { organizationName } = router.query
  const {
    session,
    organizationName: userOrganizationName,
    organizationEnabled: userOrganizationEnabled,
  } = useAuth()

  const [renderAuthorized, setRenderAuthorized] = useState(false)
  useEffect(() => {
    const _renderAuthorized =
      organizationName === userOrganizationName && userOrganizationEnabled
    setRenderAuthorized(_renderAuthorized)

    // route to home page if user isn't authorized to view this organization
    if (
      (session !== undefined && !session) ||
      (organizationName && userOrganizationName && !_renderAuthorized)
    ) {
      router.push('/')
    }
  }, [
    organizationName,
    userOrganizationName,
    userOrganizationEnabled,
    session,
    router,
  ])

  return renderAuthorized ? (
    <div className={styles.workspace}>
      <Header />
      {children}
      <ConfirmDialog />
    </div>
  ) : // show nothing if user is not authorized to view this organization
  null
}

export default Workspace
