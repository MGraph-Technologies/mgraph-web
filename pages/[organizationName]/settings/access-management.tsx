import Head from 'next/head'
import { FilterMatchMode } from 'primereact/api'
import { Column, ColumnBodyType } from 'primereact/column'
import {
  DataTable,
  DataTableFilterMeta,
  DataTableFilterMetaData,
  DataTablePFSEvent,
  DataTableSortOrderType,
} from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/AccessManagement.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

const AccessManagement: FunctionComponent = () => {
  const { organizationId } = useAuth()

  type Role = {
    id: string
    name: string
  }
  const [roles, setRoles] = useState<Role[]>([])
  const populateRoles = useCallback(async () => {
    try {
      const { data, error, status } = await supabase
        .from('roles')
        .select('id, name')
        .is('deleted_at', null)
        .order('level', { ascending: true })

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        setRoles(data as Role[])
      }
    } catch (error: unknown) {
      console.error(error)
    }
  }, [])
  useEffect(() => {
    populateRoles()
  }, [populateRoles])

  const [usersTableLoading, setUsersTableLoading] = useState(true)
  type User = {
    id: string
    email: string
    role_name: string
  }
  const [users, setUsers] = useState<User[]>([])
  const populateUsers = useCallback(async () => {
    if (organizationId) {
      setUsersTableLoading(true)
      try {
        const { data, error, status } = await supabase
          .from('organization_members')
          .select('user_id, users ( email ), roles ( name )')
          .is('deleted_at', null)
          .eq('organization_id', organizationId)

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          const _users = data.map(
            (d) =>
              ({
                id: d.user_id,
                email: d.users.email,
                role_name: d.roles.name,
              } as User)
          )
          _users.sort((a, b) => {
            if (a.email < b.email) {
              return -1
            }
            if (a.email > b.email) {
              return 1
            }
            return 0
          })
          setUsers(_users)
          setUsersTableLoading(false)
        }
      } catch (error: unknown) {
        console.error(error)
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
        const { error, status } = await supabase
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
      } catch (error: unknown) {
        analytics.track('update_user_role_error', {
          message: error,
        })
        console.error(error)
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

  const roleBodyTemplate: ColumnBodyType = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: User) => {
      return (
        <Dropdown
          value={rowData.role_name}
          options={roles.map((r) => r.name)}
          onChange={(e) => {
            const roleId = roles.find((r) => r.name === e.value)?.id
            updateUserRole(rowData.id, roleId || '')
            const newRoles = users.map((user) => {
              if (user.id === rowData.id) {
                user.role_name = roleId ? e.value : 'error'
              }
              return user
            })
            setUsers(newRoles)
          }}
          style={{ width: '100%' }}
        />
      )
    },
    [roles, updateUserRole, users]
  )

  const [orgDefaultRoleName, setOrgDefaultRoleName] = useState('')
  const populateOrgDefaultRoleName = useCallback(async () => {
    if (organizationId && roles) {
      try {
        const { data, error, status } = await supabase
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
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId, roles])
  useEffect(() => {
    populateOrgDefaultRoleName()
  }, [populateOrgDefaultRoleName])

  const updateOrgDefaultRole = useCallback(
    async (roleId: string) => {
      try {
        const { error, status } = await supabase
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
      } catch (error: unknown) {
        analytics.track('update_org_default_role_error', {
          message: error,
        })
        console.error(error)
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

  const [usersTableFirst, setUsersTableFirst] = useState(0)
  const usersTableOnPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'users',
      page: e.page,
      first: e.first,
    })
    setUsersTableFirst(e.first)
  }

  const [usersTableFilters, setUsersTableFilters] =
    useState<DataTableFilterMeta>({
      email: {
        value: null,
        matchMode: FilterMatchMode.CONTAINS,
      },
      role_name: {
        value: null,
        matchMode: FilterMatchMode.CONTAINS,
      },
    })
  const usersTableOnFilter = (e: DataTablePFSEvent) => {
    for (const key in e.filters) {
      const newFilter = e.filters[key] as DataTableFilterMetaData
      const oldFilter = usersTableFilters[key] as DataTableFilterMetaData
      if (
        !oldFilter ||
        oldFilter.value !== newFilter.value ||
        oldFilter.matchMode !== newFilter.matchMode
      ) {
        analytics.track('filter_table', {
          table: 'users',
          key: key,
          value: newFilter.value,
          matchMode: newFilter.matchMode,
        })
      }
    }
    setUsersTableFilters({
      ...usersTableFilters,
      ...e.filters,
    })
  }

  const [usersTableSortField, setUsersTableSortField] = useState('email')
  const [usersTableSortOrder, setUsersTableSortOrder] =
    useState<DataTableSortOrderType>(1)
  const usersTableOnSort = (e: DataTablePFSEvent) => {
    analytics.track('sort_table', {
      table: 'users',
      sortField: e.sortField,
      sortOrder: e.sortOrder,
    })
    setUsersTableSortField(e.sortField)
    setUsersTableSortOrder(e.sortOrder)
  }

  return (
    <>
      <Head>
        <title>Access Management — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.access_management_container}>
          <div className={styles.access_management_title}>
            Access Management
          </div>
          <h2>Add Users</h2>
          <p>
            Anyone under your organization&apos;s domain can access MGraph via
            Google OAuth - just share a link!
          </p>
          <h3>Default role for new users:</h3>
          <Dropdown
            value={orgDefaultRoleName}
            options={roles.map((r) => r.name)}
            onChange={(e) => {
              const roleId = roles.find((r) => r.name === e.value)?.id
              updateOrgDefaultRole(roleId || '')
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
              first={usersTableFirst}
              onPage={usersTableOnPage}
              filterDisplay="row"
              filters={usersTableFilters}
              onFilter={usersTableOnFilter}
              sortField={usersTableSortField}
              sortOrder={usersTableSortOrder}
              onSort={usersTableOnSort}
              emptyMessage="No users found"
            >
              <Column
                field="email"
                header="Email"
                sortable
                filter
                filterPlaceholder="Search"
                showFilterMenu={false}
              />
              <Column
                field="role_name"
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
    </>
  )
}

export default AccessManagement
