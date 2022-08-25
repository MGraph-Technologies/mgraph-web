import { FilterMatchMode } from 'primereact/api'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/AccessManagement.module.css'
import { supabase } from '../../../utils/supabaseClient'

type AccessManagementProps = {}
const AccessManagement: FunctionComponent<AccessManagementProps> = () => {
  const { organizationId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const populateUsers = useCallback(async () => {
    if (organizationId) {
      setLoading(true)
      try {
        let { data, error, status } = await supabase
          .from('organization_members')
          .select('organization_id, user_id, users ( email ), roles ( name )')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          data.sort((a, b) => {
            if (a.users.email < b.users.email) {
              return -1
            }
            if (a.users.email > b.users.email) {
              return 1
            }
            return 0
          })
          setUsers(data)
          setLoading(false)
        }
      } catch (error: any) {
        alert(error.message)
      }
    } else {
      console.log('No organizationId')
    }
  }, [organizationId])
  useEffect(() => {
    populateUsers()
  }, [populateUsers])

  const [roles, setRoles] = useState<any[]>([])
  const populateRoles = useCallback(async () => {
    try {
      let { data, error, status } = await supabase
        .from('roles')
        .select('id, name')
        .is('deleted_at', null)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        data.sort((a, b) => {
          if (a.name < b.name) {
            return -1
          }
          if (a.name > b.name) {
            return 1
          }
          return 0
        })
        setRoles(data)
      }
    } catch (error: any) {
      alert(error.message)
    }
  }, [])
  useEffect(() => {
    populateRoles()
  }, [populateRoles])

  const updateRole = useCallback(async (userId: string, roleId: string) => {
    try {
      setLoading(true)
      let { error, status } = await supabase
        .from('organization_members')
        .update({
          organization_id: organizationId,
          user_id: userId,
          role_id: roleId,
        })
        .match({
          organization_id: organizationId,
          user_id: userId,
        })
      
      if (error) {
        throw error
      }
      if (status !== 200) {
        throw new Error('Update failed')
      }
    } catch (error: any) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  const tableHeader = (
    <div className="table-header">
        Access Management
    </div>
  )

  const roleBodyTemplate = (rowData: any) => {
      return (
        <Dropdown
          value={rowData.roles.name}
          options={roles.map(r => r.name)}
          onChange={(e) => {
            const roleId = roles.find(r => r.name === e.value).id
            updateRole(rowData.user_id, roleId)
            let newRoles = users.map((user) => {
              if (user.user_id === rowData.user_id) {
                user.roles.name = e.value
              }
              return user
            })
            setUsers(newRoles)
          }}
          style={{ width: '100%' }}
        />
      )
  }

  return (
    <Workspace>
      <div className={styles.users_table_container}>
        <DataTable
          paginator
          scrollable
          className='p-datatable-users'
          header={tableHeader}
          value={users}
          loading={loading}
          scrollHeight='flex'
          rows={10}
          paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
          currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
          filterDisplay="row"
          filters={{
            'users.email': { value: null, matchMode: FilterMatchMode.CONTAINS },
            'roles.name': { value: null, matchMode: FilterMatchMode.CONTAINS },
          }}
          emptyMessage="No users found"
        >
          <Column
            field='users.email'
            header='Email'
            sortable
            filter
            filterPlaceholder='Search'
            showFilterMenu={false}
          />
          <Column
            field='roles.name'
            header='Role'
            body={roleBodyTemplate}
            sortable
            filter
            filterPlaceholder='Search'
            showFilterMenu={false}
          />
        </DataTable>
      </div>
    </Workspace>
  )
}

export default AccessManagement
