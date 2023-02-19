import { Badge } from 'primereact/badge'
import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Node } from 'reactflow'

import CommentsProvider from 'components/graph/CommentsProvider'
import { useGraph } from 'contexts/graph'
import styles from 'styles/NodeCommentsButton.module.css'
import { analytics } from 'utils/segmentClient'
import { supabase } from 'utils/supabaseClient'

type NodeCommentsButtonProps = {
  node: Node | undefined
}
const _NodeCommentsButton: FunctionComponent<NodeCommentsButtonProps> = ({
  node,
}) => {
  const { latestCommentIdMap, setLatestCommentIdMap } = useGraph()
  const commentsOverlay = useRef<OverlayPanel>(null)

  const [latestTopicCommentId, setLatestTopicCommentId] = useState<
    string | null
  >(null)
  const [topicRecentComments, setTopicRecentComments] = useState(0)
  const fetchTopicRecentComments = useCallback(async () => {
    const recentCommentsCutoff = new Date(Date.now() - 86400000).toISOString()
    if (node?.id && setLatestCommentIdMap) {
      const { data, error } = await supabase
        .from('comments')
        .select('id')
        .eq('topic_id', node.id)
        .gte('created_at', recentCommentsCutoff)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        const sceComments = data as {
          id: string
        }[]
        setTopicRecentComments(sceComments?.length || 0)
        const _latestTopicCommentId = sceComments?.[0]?.id || null
        setLatestTopicCommentId(_latestTopicCommentId)
        setLatestCommentIdMap((latestCommentIdMap) => ({
          ...latestCommentIdMap,
          [node.id]: _latestTopicCommentId,
        }))
      }
    }
  }, [node?.id, setLatestCommentIdMap])
  // initialize recent comments
  useEffect(() => {
    if (latestTopicCommentId) return
    fetchTopicRecentComments()
  }, [latestTopicCommentId, fetchTopicRecentComments])
  // listen for new comments
  useEffect(() => {
    const _latestTopicCommentId = latestCommentIdMap[node?.id || '']
    if (
      _latestTopicCommentId &&
      _latestTopicCommentId !== latestTopicCommentId
    ) {
      fetchTopicRecentComments()
    }
  }, [
    latestCommentIdMap,
    node?.id,
    latestTopicCommentId,
    fetchTopicRecentComments,
  ])

  if (node) {
    return (
      <>
        <Button
          id="comments-button"
          className={`${styles.button} p-button-text p-button-lg p-overlay-badge p-button-icon-only`}
          icon="pi pi-comment"
          onClick={(event) => {
            commentsOverlay.current?.toggle(event)
            event.stopPropagation()
          }}
          tooltip={
            topicRecentComments
              ? `${topicRecentComments} comments added in the past day`
              : undefined
          }
          tooltipOptions={{
            style: { width: '300px' },
          }}
        >
          {topicRecentComments > 0 && (
            <Badge
              severity="danger"
              // override primereact's styling so badge count is actually visible
              style={{ transform: 'translate(0%, 0%)', fontSize: '0.5em' }}
              value={topicRecentComments < 10 ? topicRecentComments : '10+'}
            />
          )}
        </Button>
        <OverlayPanel
          id="comments-overlay"
          ref={commentsOverlay}
          onShow={() => {
            analytics.track('show_comments', {
              topicId: node.id,
            })
          }}
          onHide={() => {
            analytics.track('hide_comments', {
              topicId: node.id,
            })
          }}
        >
          {node && (
            <div
              className={styles.comments_container}
              onClick={(event) => {
                event.stopPropagation()
              }}
            >
              <CommentsProvider
                topicId={node.id}
                parentId={null}
                showInput={true}
              />
            </div>
          )}
        </OverlayPanel>
      </>
    )
  } else {
    return null
  }
}

const NodeCommentsButton = React.memo(_NodeCommentsButton)
export default NodeCommentsButton
