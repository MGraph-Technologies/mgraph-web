import { FunctionComponent, useEffect, useState } from 'react'
import { Node } from 'reactflow'

import {
  GoalStatus,
  GoalStatusIndicator,
} from 'components/graph/node_detail/GoalsTable'
import { useAuth } from 'contexts/auth'
import { useBrowser } from 'contexts/browser'
import { useGraph } from 'contexts/graph'
import { analytics } from 'utils/segmentClient'

type NodeGoalsStatusButtonProps = {
  node: Node | undefined
}
const NodeGoalsStatusButton: FunctionComponent<NodeGoalsStatusButtonProps> = ({
  node,
}) => {
  const { organizationName } = useAuth()
  const { push } = useBrowser()
  const { goalStatusMap } = useGraph()

  const [localGoalStatuses, setLocalGoalStatuses] = useState<GoalStatus[]>([])
  useEffect(() => {
    let _localGoalStatuses: GoalStatus[] = []
    if (goalStatusMap && node?.data?.id) {
      const localGoalStatusMap = goalStatusMap[node.data.id]
      if (localGoalStatusMap) {
        _localGoalStatuses = Object.values(localGoalStatusMap)
      }
    }
    setLocalGoalStatuses(_localGoalStatuses)
  }, [goalStatusMap, node?.data?.id])

  // only indicate status if ongoing goal exists
  const activeGoalStatuses: GoalStatus[] = ['ahead', 'behind']
  if (
    node?.data?.id &&
    localGoalStatuses.some((goalStatus) =>
      activeGoalStatuses.includes(goalStatus)
    )
  ) {
    return (
      <GoalStatusIndicator
        id={`${node?.data?.id}-goal-status-indicator`}
        goalStatus={
          localGoalStatuses.some((goalStatus) => goalStatus === 'behind')
            ? 'behind'
            : 'ahead'
        }
        onClick={() => {
          analytics.track('click_metric_node_alert_badge', {
            nodeId: node?.data?.id,
            type: 'goal',
          })
          push(`/${organizationName}/nodes/${node.data.id}#goals`)
        }}
      />
    )
  } else {
    return null
  }
}

export default NodeGoalsStatusButton
