import { Button } from 'primereact/button'
import { confirmDialog } from 'primereact/confirmdialog'
import {
  Dispatch,
  FunctionComponent,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import MentionField from 'components/MentionField'
import UserAvatar, { User } from 'components/UserAvatar'
import { useAuth } from 'contexts/auth'
import styles from 'styles/CommentsProvider.module.css'
import { supabase } from 'utils/supabaseClient'

type Comment = {
  id: string
  organization_id: string
  user_id: string
  topic_id: string
  parent_id: string | null
  content: string
  created_at: string
  updated_at: string
  edited_at: string | null
  resolved_at: string | null
  deleted_at: string | null
}
const COMMENT_FIELDS =
  'id, organization_id, user_id, topic_id, parent_id, content, created_at, updated_at, edited_at, resolved_at, deleted_at'

type CommentsProviderProps = {
  topicId: string
  parentId: string | null
  showInput: boolean
}
const CommentsProvider: FunctionComponent<CommentsProviderProps> = ({
  topicId,
}) => {
  const [comments, setComments] = useState<Comment[]>([])
  const [users, setUsers] = useState<Set<User>>(new Set())

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      const query = supabase
        .from('comments')
        .select(COMMENT_FIELDS)
        .eq('topic_id', topicId)
        .is('deleted_at', null)

      const { data, error } = await query.order('created_at', {
        ascending: true,
      })

      if (error) {
        console.error(error)
        return
      }

      if (data) {
        const _comments = data as Comment[]
        setComments(_comments)
      }
    }
    fetchComments()
  }, [topicId])

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      const unFetchedUserIds = comments
        .map((comment) => comment.user_id)
        .filter(
          (userId) => !Array.from(users).some((user) => user.id === userId)
        )

      if (unFetchedUserIds.length === 0) return

      const { data, error } = await supabase
        .from('display_users')
        .select('id, name, email, avatar_url')
        .in('id', unFetchedUserIds)

      if (error) {
        console.error(error)
        return
      }

      if (data) {
        const _users = data.map(
          (user) =>
            ({
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatar_url,
            } as User)
        )
        setUsers(new Set([...Array.from(users), ..._users]))
      }
    }
    fetchUsers()
  }, [comments, users])

  return (
    <CommentThread
      key={`comment-thread-${topicId}-null`}
      topicId={topicId}
      parentId={null}
      comments={comments}
      setComments={setComments}
      users={Array.from(users)}
      showInput={true}
    />
  )
}

type CommentThreadProps = {
  topicId: string
  parentId: string | null
  comments: Comment[]
  setComments: Dispatch<SetStateAction<Comment[]>>
  users: User[]
  showInput: boolean
}
const CommentThread: FunctionComponent<CommentThreadProps> = ({
  topicId,
  parentId,
  comments,
  setComments,
  users,
  showInput,
}) => {
  const { session, getValidAccessToken, organizationId } = useAuth()

  const threadComments = comments.filter(
    (comment) => comment.parent_id === parentId
  )
  // Non-top-level threads are collapsed by default
  const [showThread, setShowThread] = useState(parentId ? false : true)
  const [newComment, setNewComment] = useState('')

  // Scroll to bottom of thread when it is initialized
  const [threadInitialized, setThreadInitialized] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const scrollThreadToBottom = useCallback(() => {
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight)
  }, [])
  useEffect(() => {
    if (!threadInitialized && threadComments.length > 0) {
      scrollThreadToBottom()
      setThreadInitialized(true)
    }
  }, [threadInitialized, threadComments, scrollThreadToBottom])

  const addComment = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('comments')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        topic_id: topicId,
        parent_id: parentId,
        content: newComment,
      })
      .select(COMMENT_FIELDS)
      .single()

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setComments((prev) => [...prev, data])
      setNewComment('')
      setShowThread(true)
      scrollThreadToBottom()

      // trigger notifications
      const accessToken = getValidAccessToken()
      if (!accessToken) {
        console.error('No access token to initiate notifications')
        return
      }
      const notifResp = await fetch('/api/v1/notifications/comment', {
        method: 'POST',
        headers: {
          'supabase-access-token': accessToken,
        },
        body: JSON.stringify({
          commentId: data.id,
        }),
      })
      if (notifResp.status !== 200) {
        console.error('Error initiating notifications', notifResp)
      }
    }
  }, [
    session?.user?.id,
    organizationId,
    topicId,
    parentId,
    newComment,
    setComments,
    scrollThreadToBottom,
    getValidAccessToken,
  ])

  return (
    <div className={styles.comments_thread}>
      {showThread ? (
        <div
          className={styles.comments_container}
          ref={threadRef}
          style={
            parentId
              ? {}
              : {
                  // only top level is scrollable
                  maxHeight: '400px',
                  overflowY: 'auto',
                }
          }
        >
          {parentId && (
            // allow users to collapse child threads
            <div className={styles.collapse_thread_container}>
              <Button
                className="p-button-text"
                onClick={() => {
                  setShowThread(false)
                }}
              />
            </div>
          )}
          <div className={styles.comments}>
            {threadComments.map((comment) => (
              <CommentDisplay
                key={`comment-${comment.id}`}
                comment={comment}
                comments={comments}
                setComments={setComments}
                users={users}
              />
            ))}
          </div>
        </div>
      ) : (
        threadComments.length > 0 && (
          <div className={styles.expand_thread_container}>
            <Button
              className="p-button-text"
              onClick={() => {
                setShowThread(true)
              }}
            >
              {`Show ${threadComments.length} repl${
                threadComments.length > 1 ? 'ies' : 'y'
              }`}
            </Button>
          </div>
        )
      )}
      {showInput && (
        <div className={styles.new_comment_container}>
          <MentionField
            id={`new-comment-field-${topicId}-` + JSON.stringify(parentId)}
            className={styles.input_field_container}
            inputClassName={styles.input_field}
            editable={true}
            value={newComment}
            setValue={setNewComment}
            placeholder={'Add a comment...'}
          />
          <Button
            className={styles.add_button}
            icon="pi pi-send"
            onClick={() => {
              addComment()
            }}
          />
        </div>
      )}
    </div>
  )
}

type CommentDisplayProps = {
  comment: Comment
  comments: Comment[]
  setComments: Dispatch<SetStateAction<Comment[]>>
  users: User[]
}
const CommentDisplay: FunctionComponent<CommentDisplayProps> = ({
  comment,
  comments,
  setComments,
  users,
}) => {
  const { session } = useAuth()
  const [displayContent, setDisplayContent] = useState(comment.content)
  const displayDates =
    new Date(comment.created_at).toISOString().split('.')[0] +
    (comment.edited_at
      ? ` | edited: ${new Date(comment.edited_at).toISOString().split('.')[0]}`
      : '')
  const [displayName, setDisplayName] = useState('')
  const [editingEnabled, setEditingEnabled] = useState(false)
  const [replyingEnabled, setReplyingEnabled] = useState(false)
  const [user, setUser] = useState<User>({
    id: comment.user_id,
    name: '',
    email: '',
    avatarUrl: '',
  })

  // set user and displayName
  useEffect(() => {
    const user = users.find((u) => u.id === comment.user_id)
    if (user) {
      setUser(user)
      setDisplayName(user?.name || user?.email || '')
    }
  }, [comment.user_id, users])

  const deleteComment = useCallback(async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('comments')
      .update({
        updated_at: now,
        deleted_at: now,
      })
      .eq('id', comment.id)
      .select('id')
      .single()

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
    }
  }, [comment.id, setComments])

  const confirmDeleteComment = useCallback(() => {
    confirmDialog({
      message: `Are you sure you want to delete this comment?`,
      icon: 'pi pi-exclamation-triangle',
      accept: deleteComment,
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptClassName: 'p-button-danger',
    })
  }, [deleteComment])

  const editComment = useCallback(async () => {
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('comments')
      .update({
        content: displayContent,
        updated_at: now,
        edited_at: now,
      })
      .eq('id', comment.id)
      .select(COMMENT_FIELDS)
      .single()

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === comment.id) {
            return data
          }
          return c
        })
      )
    }
  }, [displayContent, comment.id, setComments])

  return (
    <div
      key={`comment-${comment.id}-display`}
      className={styles.comment_display}
    >
      <div className={styles.avatar}>
        <UserAvatar user={user} />
      </div>
      <div className={styles.content}>
        <div className={styles.header}>{displayName}</div>
        <MentionField
          id={`comment-${comment.id}-body`}
          className={styles.body}
          editable={editingEnabled}
          value={displayContent}
          setValue={setDisplayContent}
        />
        <div className={styles.footer}>
          <div className={styles.dates}>{displayDates}</div>
          <div className={styles.actions}>
            {editingEnabled ? (
              <>
                <Button
                  className="p-button-text"
                  onClick={() => {
                    setDisplayContent(comment.content)
                    setEditingEnabled(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="p-button-text"
                  onClick={() => {
                    if (!editComment) return
                    editComment()
                    setEditingEnabled(false)
                  }}
                >
                  Save
                </Button>
              </>
            ) : replyingEnabled ? (
              <Button
                className="p-button-text"
                onClick={() => setReplyingEnabled(false)}
              >
                Cancel
              </Button>
            ) : (
              <>
                {session?.user?.id === user?.id && (
                  <>
                    <Button
                      className="p-button-text"
                      onClick={() => setEditingEnabled(true)}
                    >
                      Edit
                    </Button>
                    <Button
                      className="p-button-text"
                      onClick={confirmDeleteComment}
                    >
                      Delete
                    </Button>
                  </>
                )}
                <Button
                  className="p-button-text"
                  onClick={() => setReplyingEnabled(true)}
                >
                  Reply
                </Button>
              </>
            )}
          </div>
        </div>
        <CommentThread
          topicId={comment.topic_id}
          parentId={comment.id}
          comments={comments}
          setComments={setComments}
          users={users}
          showInput={replyingEnabled}
        />
      </div>
    </div>
  )
}

export default CommentsProvider
