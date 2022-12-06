import { Badge } from 'primereact/badge'
import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'
import { Node } from 'react-flow-renderer'
import { Comments, CommentsProvider } from 'supabase-comments-extension'

import styles from '../../../styles/NodeCommentsButton.module.css'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

export const GRAPH_COMMENTS_TOPIC_ID = 'graph'

type NodeCommentsButtonProps = {
  node: Node | undefined
}
const _NodeCommentsButton: FunctionComponent<NodeCommentsButtonProps> = ({
  node,
}) => {
  const commentsOverlay = useRef<OverlayPanel>(null)
  const [commentsOverlayVisible, setCommentsOverlayVisible] = useState(false)

  const [topicRecentComments, setTopicRecentComments] = useState(0)
  useEffect(() => {
    const recentCommentsCutoff = new Date(Date.now() - 86400000).toISOString()
    const fetchTopicRecentComments = async () => {
      if (node) {
        const { data, error } = await supabase
          .from('sce_comments')
          .select('id')
          .eq('topic', node.id)
          .gte('created_at', recentCommentsCutoff)

        if (error) {
          console.error(error)
        } else {
          setTopicRecentComments(data?.length || 0)
        }
      }
    }
    fetchTopicRecentComments()
  }, [node])

  // auto scroll top-level comments to bottom initially and on new comment
  // unfortunately there's no onCommment prop in SCE so we have to continuously check
  useEffect(() => {
    if (!commentsOverlayVisible) return
    let lastScrollHeight: number | undefined = undefined
    const interval = setInterval(() => {
      const topLevelComments = document.querySelector(
        '.rounded-md > .space-y-1' // SCE's top-level comments container
      )
      const currentScrollHeight = topLevelComments?.scrollHeight
      if (
        topLevelComments &&
        currentScrollHeight &&
        (lastScrollHeight === undefined ||
          currentScrollHeight > lastScrollHeight)
      ) {
        topLevelComments.scrollTop = currentScrollHeight
      }
      lastScrollHeight = currentScrollHeight
    }, 100)
    return () => clearInterval(interval)
  }, [commentsOverlayVisible])

  // hack to prevent SCE's dropdown overlays from closing OverlayPanel
  const [overlayDismissible, setOverlayDismissible] = useState(true)
  useEffect(() => {
    if (!commentsOverlayVisible) return
    const interval = setInterval(() => {
      const sbuiDropdown = document.querySelector(
        '[class^=sbui-dropdown__content]'
      )
      if (sbuiDropdown) {
        if (overlayDismissible) {
          setOverlayDismissible(false)
        }
      } else {
        if (!overlayDismissible) {
          setOverlayDismissible(true)
        }
      }
    }, 100)
    return () => clearInterval(interval)
  }, [commentsOverlayVisible, overlayDismissible])

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
          dismissable={overlayDismissible}
          onShow={() => {
            setCommentsOverlayVisible(true)
            analytics.track('show_comments', {
              topicId: node.id,
            })
          }}
          onHide={() => {
            setCommentsOverlayVisible(false)
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
                // increment topicRecentComments if submit button clicked
                // (this is a hacky workaround for the lack of onComment prop)
                const target = event.target as HTMLElement
                const checkTarget = (target: HTMLElement) => {
                  return (
                    target.tagName === 'SPAN' && target.textContent === 'Submit'
                  )
                }
                const checkChildren = (target: HTMLElement) => {
                  return Array.from(target.children).some((child) =>
                    checkTarget(child as HTMLElement)
                  )
                }
                if (checkTarget(target) || checkChildren(target)) {
                  setTopicRecentComments(topicRecentComments + 1)
                  analytics.track('add_comment', {
                    topicId: node.id,
                  })
                }
              }}
            >
              <CommentsProvider supabaseClient={supabase} accentColor="#3943ac">
                <Comments topic={node.id} />
              </CommentsProvider>
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
