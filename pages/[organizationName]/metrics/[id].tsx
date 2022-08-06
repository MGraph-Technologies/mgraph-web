import { useRouter } from 'next/router'
import { Button } from 'primereact/button'
import { FunctionComponent, useEffect, useState } from "react"
import { EditText, EditTextarea } from 'react-edit-text'
import 'react-edit-text/dist/index.css'

import { useEditability } from '../../../contexts/editability'
import styles from '../../../styles/MetricDetail.module.css'
import { supabase } from '../../../utils/supabaseClient'

type MetricDetailProps = {}
const MetricDetail: FunctionComponent<MetricDetailProps> = () => {
  const router = useRouter()
  const { organizationName, id } = router.query

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('') // TODO: make a graph object
  const [source, setSource] = useState('')

  const { editingEnabled } = useEditability()

  async function populateDetails() {
    if (id) {
      try {
        let { data, error, status } = await supabase
          .from('nodes')
          .select('properties, node_types!inner(*)')
          .eq('id', id)
          .eq('node_types.name', 'metric')

        if (error && status !== 406) {
          throw error
        }

        if (data) {
          setName(data[0].properties.name)
          setDescription(data[0].properties.description)
          setOwner(data[0].properties.owner)
          setSource(data[0].properties.source)
        }
      } catch (error: any) {
        alert(error.message)
      }
    }
  }
  useEffect(() => {
    populateDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          className="p-button-text"
          icon="pi pi-angle-left"
          onClick={() => {
            router.push('/' + organizationName)
          }}
        />
        <h1>
          <EditText
            value={name}
            readonly={!editingEnabled}
            onChange={(e) => setName(e.target.value)}
            // onSave={saveProperties}
          />
        </h1>
      </div>
      <div className={styles.detail_field}>
        Chart TBA
      </div>
      <h2>Description</h2>
      <div className={styles.detail_field}>
        <EditTextarea
          value={description}
          readonly={!editingEnabled}
          placeholder={ editingEnabled ? 'Add...' : '-' }
          style={{ backgroundColor: editingEnabled ? '#EEE': '#F8F8F8' }}
          onChange={(e) => setDescription(e.target.value)}
          // onSave={saveProperties}
        />
      </div>
      <h2>Inputs</h2>
      <div className={styles.detail_field}>
        Inputs TBA
      </div>
      <h2>Outputs</h2>
      <div className={styles.detail_field}>
        Outputs TBA
      </div>
      <h2>Owner</h2>
      <div className={styles.detail_field}>
        <EditText
          value={owner}
          readonly={!editingEnabled}
          placeholder={ editingEnabled ? 'Add...' : '-' }
          style={{ backgroundColor: editingEnabled ? '#EEE': '#F8F8F8' }}
          onChange={(e) => setOwner(e.target.value)}
          // onSave={saveProperties}
        />
      </div>
      <h2>Source</h2>
      <div className={styles.detail_field}>
        <EditTextarea
          value={source}
          readonly={!editingEnabled}
          placeholder={ editingEnabled ? 'Add...' : '-' }
          style={{ backgroundColor: editingEnabled ? '#EEE': '#F8F8F8' }}
          onChange={(e) => setSource(e.target.value)}
          // onSave={saveProperties}
        />
      </div>
    </div>
  )
}

export default MetricDetail
