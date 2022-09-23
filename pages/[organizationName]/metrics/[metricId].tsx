import { useRouter } from 'next/router'
import { FunctionComponent } from 'react'

import MetricDetail from '../../../components/graph/MetricDetail'
import Workspace from '../../../components/Workspace'
import styles from '../../../styles/MetricDetailPage.module.css'

type MetricDetailPageProps = {}
const MetricDetailPage: FunctionComponent<MetricDetailPageProps> = () => {
  const router = useRouter()
  const { metricId } = router.query
  return (
    // head populated by MetricDetail
    <Workspace>
      <div className={styles.metric_detail_container}>
        <MetricDetail metricId={metricId} />
      </div>
    </Workspace>
  )
}

export default MetricDetailPage
