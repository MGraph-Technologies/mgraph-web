import { useRouter } from 'next/router'
import { FunctionComponent } from 'react'

import MetricDetail from '../../../components/graph/metric_detail/MetricDetail'
import Workspace from '../../../components/Workspace'
import styles from '../../../styles/MetricDetailPage.module.css'

const MetricDetailPage: FunctionComponent = () => {
  const router = useRouter()
  const { metricId } = router.query
  return (
    // head populated by MetricDetail
    <Workspace>
      <div className={styles.metric_detail_container}>
        {typeof metricId === 'string' && metricId && (
          <MetricDetail metricId={metricId} />
        )}
      </div>
    </Workspace>
  )
}

export default MetricDetailPage
