import Head from 'next/head'
import { Button } from 'primereact/button'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { EditText } from 'react-edit-text'

import SectionHeader from 'components/SectionHeader'
import Workspace from 'components/Workspace'
import { useAuth } from 'contexts/auth'
import styles from 'styles/InputParameters.module.css'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

const InputParameters: FunctionComponent = () => {
  return (
    <>
      <Head>
        <title>Input Parameters — MGraph</title>
      </Head>
      <Workspace>
        <div className={styles.input_parameters_container}>
          <div className={styles.input_parameters_title}>Input Parameters</div>
          <SectionHeader title="Dimensions" size="h2" />
          <Field name="dimensions" example="NULL,market" />
          <SectionHeader title="Frequencies" size="h2" />
          <Field
            name="frequencies"
            example="SECOND,MINUTE,HOUR,DAY,WEEK,MONTH,QUARTER,YEAR"
          />
        </div>
      </Workspace>
    </>
  )
}

type FieldProps = {
  name: 'dimensions' | 'frequencies'
  example: string
}
const Field: FunctionComponent<FieldProps> = ({ name, example }) => {
  const { organizationId } = useAuth()
  const [value, setValue] = useState('')

  const populate = useCallback(async () => {
    if (organizationId) {
      try {
        const { data, error, status } = await supabase
          .from('organizations')
          .select('query_dimensions, query_frequencies')
          .is('deleted_at', null)
          .eq('id', organizationId)
          .order('created_at', { ascending: true })
          .single()

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          const organization = data as {
            query_dimensions: string
            query_frequencies: string
          }
          const colName = `query_${name}` as
            | 'query_dimensions'
            | 'query_frequencies'
          setValue(organization[colName])
        }
      } catch (error: unknown) {
        console.error(error)
      }
    }
  }, [organizationId, name, setValue])
  useEffect(() => {
    populate()
  }, [populate])

  const save = useCallback(
    async (newValue: string) => {
      if (organizationId) {
        try {
          const colName = `query_${name}`
          const { error, status } = await supabase
            .from('organizations')
            .update({
              [colName]: newValue,
              updated_at: new Date(),
            })
            .is('deleted_at', null)
            .eq('id', organizationId)

          if (error && status !== 406) {
            throw error
          }
        } catch (error: unknown) {
          console.error(error)
        }
      }
    },
    [organizationId, name]
  )
  return (
    <EditText
      id={`${name}-field`}
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
      }}
      onSave={({ value }) => {
        save(value)
        analytics.track(`update_query_${name}`, {
          value: value,
        })
      }}
      showEditButton
      editButtonContent={
        <Button
          id={`${name}-field-edit-button`}
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          tooltip={`Enter comma-separated values to populate the ${name} picker (spaces will be preserved; e.g., "${example}")`}
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
  )
}

export default InputParameters
