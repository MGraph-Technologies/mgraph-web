import { Tooltip } from 'primereact/tooltip'
import { FunctionComponent, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

import UserAvatar, { User } from 'components/UserAvatar'
import { useAuth } from 'contexts/auth'
import styles from 'styles/PresencePanel.module.css'
import { supabase } from 'utils/supabaseClient'

const PANEL_Z_INDEX = 5
const PANEL_MAX_DISPLAY_USERS = 5

type PresencePanelProps = {
  pageId: string
}

const PresencePanel: FunctionComponent<PresencePanelProps> = ({ pageId }) => {
  const { session, userAvatarUrl, userEmail, userName } = useAuth()
  const [presentUsers, setPresentUsers] = useState<User[]>([])

  useEffect(() => {
    type Presence = {
      user: User
      tabId: string
      onlineAt: string
    }
    const presenceChannel = supabase.channel(`presence:${pageId}`, {
      config: {
        presence: {
          key: session?.user?.id,
        },
      },
    })
    const presenceSubscription = presenceChannel
      // listen for presence updates
      .on('presence', { event: 'sync' }, () => {
        const presenceState = presenceChannel.presenceState() as unknown as {
          [key: string]: Presence[]
        }
        if (!presenceState) {
          setPresentUsers([])
          return
        }
        const sortPresences = (
          a: Presence,
          b: Presence,
          descending?: boolean
        ) => {
          const aDate = new Date(a.onlineAt).getTime()
          const bDate = new Date(b.onlineAt).getTime()
          if (aDate > bDate) {
            return descending ? -1 : 1
          } else if (aDate < bDate) {
            return descending ? 1 : -1
          } else {
            return 0
          }
        }
        const _presentUsers = Object.values(presenceState)
          // sort users by first onlineAt
          .sort((a, b) =>
            sortPresences(a.sort(sortPresences)[0], b.sort(sortPresences)[0])
          )
          // populate users from latest presence of each
          .map((presences) => {
            const latestPresence = presences.sort((a, b) =>
              sortPresences(a, b, true)
            )[0]
            return {
              id: latestPresence.user.id,
              name: latestPresence.user.name,
              email: latestPresence.user.email,
              avatarUrl: latestPresence.user.avatarUrl,
            } as User
          })
          // filter out current user
          .filter((user) => user.id !== session?.user?.id)
        setPresentUsers(_presentUsers)
      })
      .subscribe(
        // publish presence updates
        async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user: {
                id: session?.user?.id,
                name: userName,
                email: userEmail,
                avatarUrl: userAvatarUrl,
              } as User,
              tabId: uuidv4(),
              onlineAt: new Date().toISOString(),
            } as Presence)
          }
        }
      )
    return () => {
      supabase.removeChannel(presenceSubscription)
    }
  }, [pageId, session?.user?.id, userName, userEmail, userAvatarUrl])

  return (
    <div className={styles.presence_panel} style={{ zIndex: PANEL_Z_INDEX }}>
      <div className={styles.present_users}>
        {presentUsers.slice(0, PANEL_MAX_DISPLAY_USERS).map((user, index) => {
          const avatarClass = index === 0 ? styles.leftmost : styles.overlapping
          const avatarZIndex = PANEL_Z_INDEX + (presentUsers.length - index)
          return (
            <div
              key={user.id}
              className={avatarClass}
              style={{ zIndex: avatarZIndex }}
            >
              <div id={`avatar_${user.id}`}>
                <UserAvatar user={user} />
              </div>
              <Tooltip target={`[id=avatar_${user.id}]`}>
                <div className={styles.single_user_tooltip}>
                  <div>{user.name}</div>
                  <div>{user.email}</div>
                </div>
              </Tooltip>
            </div>
          )
        })}
        {presentUsers.length > PANEL_MAX_DISPLAY_USERS && (
          <>
            <div
              id="avatar_more"
              className={`${styles.overlapping} ${styles.more}`}
            >
              ...
            </div>
            <Tooltip target={`[id=avatar_more]`} position="bottom">
              <div className={styles.remaining_users_tooltip}>
                <ul>
                  {presentUsers.slice(PANEL_MAX_DISPLAY_USERS).map((user) => {
                    return (
                      <li key={user.id}>
                        <span className={styles.user_avatar}>
                          <UserAvatar user={user} />
                        </span>
                        <span className={styles.user_name}>{user.name}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}

export default PresencePanel
