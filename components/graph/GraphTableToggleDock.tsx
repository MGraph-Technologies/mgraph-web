import { TabPanel, TabView } from 'primereact/tabview'
import React, { FunctionComponent, useEffect, useState } from 'react'

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/GraphTableToggleDock.module.css'

type GraphTableToggleDockProps = {
  showGraphTable: boolean
  setShowGraphTable: (showGraphTable: boolean) => void
}
const _GraphTableToggleDock: FunctionComponent<GraphTableToggleDockProps> = ({
  showGraphTable,
  setShowGraphTable,
}) => {
  const { editingEnabled } = useEditability()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setShowGraphTable(activeIndex === 1)
  }, [activeIndex, setShowGraphTable])

  if (!editingEnabled) {
    return (
      <div className={styles.graph_table_toggle_dock}>
        <div className={styles.toggle_buttons}>
          <TabView
            activeIndex={activeIndex}
            onTabChange={(e) => setActiveIndex(e.index)}
            panelContainerStyle={{ padding: '0px' }}
          >
            <TabPanel leftIcon="pi pi-sitemap" />
            <TabPanel leftIcon="pi pi-table" />
          </TabView>
        </div>
      </div>
    )
  } else {
    return null
  }
}

const GraphTableToggleDock = React.memo(_GraphTableToggleDock)
export default GraphTableToggleDock
