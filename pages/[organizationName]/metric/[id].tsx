import { useRouter } from 'next/router'
import { FunctionComponent } from "react"

type MetricDetailProps = {}
const MetricDetail: FunctionComponent<MetricDetailProps> = () => {
  const router = useRouter()
  const { metricId } = router.query

  return (
    <div>
      <h1>Metric Detail for {metricId}</h1>
    </div>
  )
}

export default MetricDetail
