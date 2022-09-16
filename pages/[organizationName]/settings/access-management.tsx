import { FilterMatchMode } from 'primereact/api'
import { Column } from 'primereact/column'
import { DataTable, DataTableFilterMeta, DataTablePFSEvent } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/AccessManagement.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

type AccessManagementProps = {}
const AccessManagement: FunctionComponent<AccessManagementProps> = () => {
  const { organizationId } = useAuth()

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

  const [usersTableLoading, setUsersTableLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const populateUsers = useCallback(async () => {
    if (organizationId) {
      setUsersTableLoading(true)
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
          setUsersTableLoading(false)
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateUsers()
  }, [populateUsers])

  const updateUserRole = useCallback(
    async (userId: string, roleId: string) => {
      try {
        setUsersTableLoading(true)
        let { error, status } = await supabase
          .from('organization_members')
          .update({
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
        analytics.track('update_user_role_error', {
          message: error.message,
        })
        alert(error.message)
      } finally {
        analytics.track('update_user_role', {
          user_id: userId,
          role_id: roleId,
        })
        setUsersTableLoading(false)
      }
    },
    [organizationId]
  )

  const roleBodyTemplate = (rowData: any) => {
    return (
      <Dropdown
        value={rowData.roles.name}
        options={roles.map((r) => r.name)}
        onChange={(e) => {
          const roleId = roles.find((r) => r.name === e.value).id
          updateUserRole(rowData.user_id, roleId)
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

  const [orgDefaultRoleName, setOrgDefaultRoleName] = useState('')
  const populateOrgDefaultRoleName = useCallback(async () => {
    if (organizationId && roles) {
      try {
        let { data, error, status } = await supabase
          .from('organizations')
          .select('default_role_id')
          .is('deleted_at', null)
          .eq('id', organizationId)
          .single()

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setOrgDefaultRoleName(
            roles.find((role) => role.id === data.default_role_id)?.name ||
              'error'
          )
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }, [organizationId, roles])
  useEffect(() => {
    populateOrgDefaultRoleName()
  }, [populateOrgDefaultRoleName])

  const updateOrgDefaultRole = useCallback(
    async (roleId: string) => {
      try {
        let { error, status } = await supabase
          .from('organizations')
          .update({
            default_role_id: roleId,
          })
          .match({
            id: organizationId,
          })

        if (error) {
          throw error
        }
        if (status !== 200) {
          throw new Error('Update failed')
        }
      } catch (error: any) {
        analytics.track('update_org_default_role_error', {
          message: error.message,
        })
        alert(error.message)
      } finally {
        analytics.track('update_org_default_role', {
          role_id: roleId,
        })
        const newOrgDefaultRoleName =
          roles.find((role) => role.id === roleId)?.name || 'error'
        setOrgDefaultRoleName(newOrgDefaultRoleName)
      }
    },
    [organizationId, roles]
  )

  const [usersTableFilters, setUsersTableFilters] = useState<DataTableFilterMeta>({
    'users.email': {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },
    'roles.name': {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },
  })
  return (
    <Workspace>
      <div className={styles.access_management_container}>
        <div className={styles.access_management_title}>Access Management</div>
        <h2>Add Users</h2>
        <p>
          No need for invitations; anyone under your organization&apos;s domain
          can access MGraph via Google SSO - just share a link!
        </p>
        <h3>Default role for new users:</h3>
        <Dropdown
          value={orgDefaultRoleName}
          options={roles.map((r) => r.name)}
          onChange={(e) => {
            const roleId = roles.find((r) => r.name === e.value).id
            updateOrgDefaultRole(roleId)
          }}
          style={{ width: '25%' }}
        />
        <br></br>
        <h2>Edit Users</h2>
        <div className={styles.users_table_container}>
          <DataTable
            paginator
            scrollable
            className="p-datatable-users"
            value={users}
            loading={usersTableLoading}
            scrollHeight="flex"
            rows={10}
            paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
            filterDisplay="row"
            filters={usersTableFilters}
            onFilter={(e: DataTablePFSEvent) => {
              for (let key in e.filters) {
                const newFilter: any = e.filters[key]
                const oldFilter: any  = usersTableFilters[key]
                if (
                  !oldFilter ||
                  oldFilter.value !== newFilter.value ||
                  oldFilter.matchMode !== newFilter.matchMode
                ) {
                  analytics.track('filter_users_table', {
                    key: key,
                    value: newFilter.value,
                    matchMode: newFilter.matchMode,
                  })
                }
              }
              setUsersTableFilters({
                ...usersTableFilters,
                ...e.filters
              })
            }}
            emptyMessage="No users found"
          >
            <Column
              field="users.email"
              header="Email"
              sortable
              filter
              filterPlaceholder="Search"
              showFilterMenu={false}
            />
            <Column
              field="roles.name"
              header="Role"
              body={roleBodyTemplate}
              sortable
              filter
              filterPlaceholder="Search"
              showFilterMenu={false}
            />
          </DataTable>
        </div>
      </div>
    </Workspace>
  )
}

export default AccessManagement
