import { useRouter } from 'next/router'
import { FunctionComponent, useEffect } from 'react'

import { useAuth } from 'contexts/auth'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

const MGraphDbtSync: FunctionComponent = () => {
  const { organizationId, organizationName } = useAuth()
  const router = useRouter()
  const { installation_id: installationId, state: stateId } = router.query

  useEffect(() => {
    const redirect = async () => {
      const savedStateKey = `githubAppInstallState${stateId}`
      const savedState = JSON.parse(localStorage.getItem(savedStateKey) || '{}')
      if (!savedState) {
        console.error('No saved state found')
      } else {
        const installationIdNum = parseInt(installationId as string)
        try {
          /* have to set organization_id and properties here because
            state isn't accessible to our webhook handler;
            see webhooks/github.ts */
          const {
            data: graphSyncTypeData,
            error: graphSyncTypeError,
            status: graphSyncTypeStatus,
          } = await supabase
            .from('graph_sync_types')
            .select('id')
            .eq('name', 'dbt Project')
            .single()

          if (graphSyncTypeError && graphSyncTypeStatus !== 406) {
            throw graphSyncTypeError
          }
          const graphSyncType = graphSyncTypeData as { id: string }

          const { data, error, status } = await supabase
            .from('graph_syncs')
            .update({
              name: savedState.name || 'dbt Project',
              organization_id: organizationId,
              properties: {
                installationId: installationIdNum,
                repoUrl: savedState.repoUrl,
                generatedQueryTemplate: savedState.generatedQueryTemplate,
              },
              updated_at: new Date(),
            })
            .match({
              type_id: graphSyncType.id,
              'properties->installationId': installationIdNum,
            })
            .select('id')
            .single()

          if (error) {
            throw error
          }
          if (status !== 200 && status !== 204) {
            throw new Error('Update graph sync failed')
          }
          if (!data) {
            throw new Error('No graph sync found')
          }
          const graphSync = data as { id: string }
          analytics.track('create_graph_sync', {
            id: graphSync.id,
          })
          localStorage.removeItem(savedStateKey)
          router.push(`/${organizationName}/settings/graph-syncs`)
        } catch (error: unknown) {
          console.error(error)
        }
      }
    }
    redirect()
  }, [stateId, organizationId, installationId, organizationName, router])
  return <div>Loading...</div>
}

export default MGraphDbtSync
