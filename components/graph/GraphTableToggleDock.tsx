import { TabPanel, TabView } from 'primereact/tabview'
import React, { FunctionComponent, useEffect, useState } from 'react'

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/GraphTableToggleDock.module.css'
import { analytics } from '../../utils/segmentClient'

type GraphTableToggleDockProps = {
  showGraphTable: boolean
  setShowGraphTable: (showGraphTable: boolean) => void
}
const _GraphTableToggleDock: FunctionComponent<GraphTableToggleDockProps> = ({
  showGraphTable,
  setShowGraphTable,
}) => {
  const { editingEnabled } = useEditability()
  const [activeIndex, setActiveIndex] = useState(showGraphTable ? 1 : 0)

  useEffect(() => {
    const _showGraphTable = activeIndex === 1
    setShowGraphTable(_showGraphTable)
    analytics.track('toggle_graph_table', {
      show_graph_table: _showGraphTable,
    })
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
