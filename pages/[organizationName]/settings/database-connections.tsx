import { FunctionComponent } from 'react'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/DatabaseConnections.module.css'

type DatabaseConnectionsProps = {}
const DatabaseConnections: FunctionComponent<DatabaseConnectionsProps> = () => {
  const { organizationId } = useAuth()

  return (
    <Workspace>
      <div className={styles.database_connections_container}>
        <p>
          To add, remove, or edit database connections, please contact an MGraph team member.
        </p>
      </div>
    </Workspace>
  )
}

export default DatabaseConnections
