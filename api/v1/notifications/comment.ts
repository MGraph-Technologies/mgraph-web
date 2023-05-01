import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { NextApiRequest, NextApiResponse } from 'next'
import fetch from 'node-fetch'

import { SENTRY_CONFIG } from '../../../sentry.server.config.js'
import { getBaseUrl } from '../../../utils/appBaseUrl'

Sentry.init(SENTRY_CONFIG)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  console.log('\n\nNew request to /api/v1/notifications/comment...')
  const method = req.method
  if (method === 'POST') {
    const body = JSON.parse(req.body)
    console.log('\nBody: ', body)
    const { commentId } = body

    const accessToken = (req.headers['supabase-access-token'] as string) || ''
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    })
    try {
      const recipientUserIds = new Set<string>()
      const recipientEmails = new Set<string>()

      // get user
      const { data: userData, error: userError } = await supabase.auth.getUser(
        accessToken
      )
      if (userError) throw userError
      const user = userData.user
      if (!user) throw new Error('User not found')
      const userId = user.id
      console.log('\nInitiated by user ', userId)
      const { data: duData, error: duError } = await supabase
        .from('display_users')
        .select('email, name')
        .eq('id', userId)
        .single()
      if (duError) throw duError
      if (!duData) throw new Error('User not found')
      const displayUser = duData as {
        email: string
        name: string
      }

      // get comment
      type Comment = {
        id: string
        topic_id: string
        parent_id: string
        user_id: string
        content: string
        organizations: { name: string; domain: string }
      }
      const COMMENT_FIELDS =
        'id, topic_id, parent_id, user_id, content, organizations ( name, domain )'
      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .select(COMMENT_FIELDS)
        .eq('id', commentId)
        .single()
      if (commentError) throw commentError
      if (!commentData) throw new Error('Latest comment not found')
      const comment = commentData as Comment
      console.log('\nLatest user comment: ', JSON.stringify(comment))
      const {
        topic_id: commentTopicId,
        parent_id: commentParentId,
        content: commentContent,
        organizations: {
          name: commentOrganizationName,
          domain: commentOrganizationDomain,
        },
      } = comment

      const atMentionsToEmails: (
        content: string,
        organizationDomain: string
      ) => string[] = (content, organizationDomain) => {
        const atUsernames = content.match(/@[\w\d._+-]+/g)
        if (!atUsernames) return []
        return atUsernames.map((atUsername: string) => {
          const username = atUsername.substring(1)
          const email = `${username}@${organizationDomain}`
          return email
        })
      }
      const commentMentionedUserEmails = atMentionsToEmails(
        commentContent,
        commentOrganizationDomain
      )
      commentMentionedUserEmails.forEach((email: string) =>
        recipientEmails.add(email)
      )

      // get writers and mentioned users from same-parent comments
      if (commentParentId) {
        const { data: sameThreadCommentsData, error: sameThreadCommentsError } =
          await supabase
            .from('comments')
            .select(COMMENT_FIELDS)
            .or(`id.eq.${commentParentId},parent_id.eq.${commentParentId}`)
            .is('deleted_at', null)
            .not('id', 'eq', commentId)
        if (sameThreadCommentsError) throw sameThreadCommentsError
        console.log(
          '\nSame-thread comments: ',
          JSON.stringify(sameThreadCommentsData)
        )
        if (sameThreadCommentsData) {
          const sameThreadComments = sameThreadCommentsData as Comment[]
          sameThreadComments.forEach((sameThreadComment) => {
            recipientUserIds.add(sameThreadComment.user_id)
            const sameThreadCommentMentionedUserEmails = atMentionsToEmails(
              sameThreadComment.content,
              sameThreadComment.organizations.domain
            )
            sameThreadCommentMentionedUserEmails.forEach((email: string) =>
              recipientEmails.add(email)
            )
          })
        }
      }

      // get nodeData corresponding to topic, including any users named as owners
      const { data: nodeData, error: nodeError } = await supabase
        .from('nodes')
        .select('id, properties, organizations ( name, domain )')
        .eq('id', commentTopicId)
        .single()
      if (nodeError) throw nodeError
      if (nodeData) {
        const node = nodeData as {
          id: string
          properties: {
            name: string
            owner: string
            [key: string]: string
          }
          organizations: { name: string; domain: string }
        }
        const { properties, organizations } = node
        const { owner } = properties
        console.log('\nNode owner: ', owner)
        if (owner) {
          const ownerMentionedUserEmails = atMentionsToEmails(
            owner,
            organizations.domain
          )
          ownerMentionedUserEmails.forEach((email: string) =>
            recipientEmails.add(email)
          )
        }
      }

      // get addresses of users to notify
      const orConditions = [
        `id.in.(${Array.from(recipientUserIds).join(',')})`,
        `email.in.(${Array.from(recipientEmails).join(',')})`,
      ]
      console.log('\nOr strings: ', JSON.stringify(orConditions))
      const { data: recipientUsersData, error: recipientUsersError } =
        await supabase
          .from('display_users')
          .select('email')
          .or(orConditions.join(','))
          .not('id', 'eq', userId)
      if (recipientUsersError) throw recipientUsersError
      if (recipientUsersData && recipientUsersData.length) {
        const recipientUsers = recipientUsersData as { email: string }[]
        console.log('\nRecipient users: ', JSON.stringify(recipientUsers))
        // todo: send email to each recipient
        const commenter = displayUser.name || displayUser.email
        const nodeId = nodeData?.id
        const nodeName = nodeData?.properties.name
        const sendgridResp = await fetch(
          'https://api.sendgrid.com/v3/mail/send',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            },
            body: JSON.stringify({
              from: {
                email: process.env.NEXT_PUBLIC_EMAIL_FROM_ADDRESS,
                name: 'MGraph',
              },
              template_id: process.env.NEXT_PUBLIC_EMAIL_SENDGRID_TEMPLATE_ID,
              personalizations: recipientUsers.map((recipientUser) => {
                const { email } = recipientUser
                return {
                  to: [{ email }],
                  dynamic_template_data: {
                    commenter: commenter,
                    comment: commentContent,
                    on_node: nodeName ? ` on ${nodeName}` : '',
                    cta_url:
                      `${getBaseUrl()}/${commentOrganizationName}` +
                      (nodeId ? `/nodes/${nodeId}` : ''),
                  },
                }
              }),
            }),
          }
        )
        console.log('\nSendgrid response: ', sendgridResp)
        return res.status(200).json({
          sendgridResp: sendgridResp,
        })
      } else {
        console.log('\nNo recipients')
        return res.status(200).json({})
      }
    } catch (error: unknown) {
      console.error('\nError: ', error)
      return res.status(500).json({
        error: error,
      })
    }
  } else {
    console.error('\nUnsupported method: ', method)
    return res.status(405).json({
      error: 'Method not allowed',
    })
  }
}

export default Sentry.withSentryAPI(handler, 'api/v1/notifications/comment')
