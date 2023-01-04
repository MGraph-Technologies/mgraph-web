import Head from 'next/head'
import { Button } from 'primereact/button'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { EditText } from 'react-edit-text'
import SectionHeader from '../../../components/SectionHeader'

import Workspace from '../../../components/Workspace'
import { useAuth } from '../../../contexts/auth'
import styles from '../../../styles/QueryParameters.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

const QueryParameters: FunctionComponent = () => {
  const { organizationId } = useAuth()

  const [dimensions, setDimensions] = useState('')
  const populateDimensions = useCallback(async () => {
    if (organizationId) {
      try {
        const { data, error, status } = await supabase
          .from('organizations')
          .select('query_dimensions')
          .is('deleted_at', null)
          .eq('id', organizationId)
          .order('created_at', { ascending: true })
          .single()

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setDimensions(data.query_dimensions)
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId])
  useEffect(() => {
    populateDimensions()
  }, [populateDimensions])

  const updateDimensions = useCallback(
    async (newDimensions: string) => {
      if (organizationId) {
        try {
          const { data, error, status } = await supabase
            .from('organizations')
            .update({ query_dimensions: newDimensions })
            .is('deleted_at', null)
            .eq('id', organizationId)
            .single()

          if (error && status !== 406) {
            throw error
          }

          if (data) {
            setDimensions(data.query_dimensions)
          }
        } catch (error: unknown) {
          console.error(error)
        }
      }
    },
    [organizationId]
  )

  return (
    <>
      <Head>
        <title>Query Parameters — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.query_parameters_container}>
          <div className={styles.query_parameters_title}>Query Parameters</div>
          <SectionHeader title="Dimensions" size="h2" />
          <EditText
            id="dimensions-field"
            value={dimensions}
            onChange={(e) => {
              setDimensions(e.target.value)
            }}
            onSave={({ value }) => {
              updateDimensions(value)
              analytics.track('update_query_dimensions', {
                value: value,
              })
            }}
            showEditButton
            editButtonContent={
              <Button
                id="dimensions-field-edit-button"
                icon="pi pi-pencil"
                className="p-button-rounded p-button-text"
                tooltip='Enter comma-separated values to populate the Dimensions picker (spaces will be preserved; e.g., "NULL,market")'
                tooltipOptions={{
                  style: { width: '300px' },
                }}
              />
            }
            style={{
              backgroundColor: '#fff',
              width: '300px',
              border: '1px solid #d9d9d9',
              borderRadius: '5px',
            }}
          />
        </div>
      </Workspace>
    </>
  )
}

export default QueryParameters
