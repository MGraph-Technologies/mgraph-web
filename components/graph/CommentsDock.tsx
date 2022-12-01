import React, { FunctionComponent, useEffect } from 'react'
import { Comments, CommentsProvider } from 'supabase-comments-extension'

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/CommentsDock.module.css'
import { supabase } from '../../utils/supabaseClient'

export const GRAPH_COMMENTS_TOPIC_ID = 'graph'

type CommentsDockProps = {
  topicId: string
}
const _CommentsDock: FunctionComponent<CommentsDockProps> = ({ topicId }) => {
  const { commentingEnabled } = useEditability()

  // auto scroll top-level comments to bottom initially and on new comment
  // unfortunately there's no onCommment prop so we have to continuously check
  useEffect(() => {
    const scrollCommentsIfNeeded = (lastScrollHeight: number | undefined) => {
      const topLevelComments = document.querySelector(
        '.rounded-md > .space-y-1' // SCE's top-level comments container
      )
      const currentScrollHeight = topLevelComments?.scrollHeight
      if (
        currentScrollHeight &&
        (lastScrollHeight === undefined ||
          currentScrollHeight > lastScrollHeight)
      ) {
        topLevelComments.scrollTop = currentScrollHeight
      }
      setTimeout(() => {
        scrollCommentsIfNeeded(currentScrollHeight)
      }, 100)
    }
    scrollCommentsIfNeeded(undefined)
  }, [])

  if (commentingEnabled) {
    return (
      <div className={styles.comments_dock}>
        <CommentsProvider supabaseClient={supabase} accentColor="#3943ac">
          <Comments topic={topicId} />
        </CommentsProvider>
      </div>
    )
  } else {
    return null
  }
}

const CommentsDock = React.memo(_CommentsDock)
export default CommentsDock
