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
    const { topicId } = body

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

      // get user
      const { data: userData, error: userError } = await supabase.auth.getUser(
        accessToken
      )
      if (userError) throw userError
      const user = userData.user
      if (!user) throw new Error('User not found')
      const userId = user.id
      console.log('\nInitiated by user ', userId)
      const { data: sduData, error: sduError } = await supabase
        .from('sce_display_users')
        .select('email, name')
        .eq('id', userId)
        .single()
      if (sduError) throw sduError
      if (!sduData) throw new Error('User not found')
      const sceDisplayUser = sduData as {
        email: string
        name: string
      }

      // get parent id and mentioned users from their latest comment
      const { data: latestCommentData, error: latestCommentError } =
        await supabase
          .from('sce_comments')
          .select('id, parent_id, user_id, comment, mentioned_user_ids')
          .match({
            topic: topicId,
            user_id: userId,
          })
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      if (latestCommentError) throw latestCommentError
      if (!latestCommentData) throw new Error('Latest comment not found')
      type Comment = {
        id: string
        parent_id: string
        user_id: string
        comment: string
        mentioned_user_ids: string[]
      }
      const latestComment = latestCommentData as Comment
      console.log('\nLatest user comment: ', JSON.stringify(latestComment))
      const {
        id: latestCommentId,
        parent_id: latestCommentParentId,
        mentioned_user_ids: latestCommentMentionedUserIds,
      } = latestComment
      latestCommentMentionedUserIds.forEach((id: string) =>
        recipientUserIds.add(id)
      )

      // get writers and mentioned users from same-parent comments
      if (latestCommentParentId) {
        const { data: sameThreadCommentsData, error: sameThreadCommentsError } =
          await supabase
            .from('sce_comments')
            .select('id, parent_id, user_id, comment, mentioned_user_ids')
            .match({
              topic: topicId,
              parent_id: latestCommentParentId,
            })
            .not('id', 'eq', latestCommentId)
        if (sameThreadCommentsError) throw sameThreadCommentsError
        console.log(
          '\nSame-thread comments: ',
          JSON.stringify(sameThreadCommentsData)
        )
        if (sameThreadCommentsData) {
          const sameThreadComments = sameThreadCommentsData as Comment[]
          sameThreadComments.forEach(
            (comment: {
              id: string
              user_id: string
              mentioned_user_ids: string[]
            }) => {
              recipientUserIds.add(comment.user_id)
              comment.mentioned_user_ids.forEach((id: string) =>
                recipientUserIds.add(id)
              )
            }
          )
        }
      }

      // get nodeData corresponding to topic, including any users named as owners
      const nodeOwnerEmails = new Set<string>()
      const { data: nodeData, error: nodeError } = await supabase
        .from('nodes')
        .select(
          'properties, node_types ( name ), organizations ( name, domain )'
        )
        .eq('id', topicId)
        .single()
      if (nodeError) throw nodeError
      if (!nodeData) throw new Error('Node not found')
      const node = nodeData as {
        properties: {
          owner: string
          [key: string]: string
        }
        node_types: { name: string }
        organizations: { name: string; domain: string }
      }
      const { properties, node_types, organizations } = node
      const { owner } = properties
      console.log('\nNode owner: ', owner)
      if (owner) {
        // parse out @mentions
        const ownerAtUsernames = owner.match(/@[\w\d._+-]+/g)
        ownerAtUsernames?.forEach((atUsername: string) => {
          const username = atUsername.substring(1)
          const ownerEmail = `${username}@${organizations.domain}`
          nodeOwnerEmails.add(ownerEmail)
        })
      }

      // get addresses of users to notify
      const orConditions = [
        `id.in.(${Array.from(recipientUserIds).join(',')})`,
        `email.in.(${Array.from(nodeOwnerEmails).join(',')})`,
      ]
      console.log('\nOr strings: ', JSON.stringify(orConditions))
      const { data: recipientUsersData, error: recipientUsersError } =
        await supabase
          .from('sce_display_users')
          .select('email')
          .or(orConditions.join(','))
          .not('id', 'eq', userId)
      if (recipientUsersError) throw recipientUsersError
      if (recipientUsersData && recipientUsersData.length) {
        const recipientUsers = recipientUsersData as { email: string }[]
        const recipientEmails = recipientUsers.map((user) => user.email)
        console.log('\nRecipient emails: ', recipientEmails)
        // todo: send email to each recipient
        const commenter = sceDisplayUser.name || sceDisplayUser.email
        const nodeName = properties.name
        const nodeTypeName = node_types.name
        const nodeOrgName = organizations.name
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
                email: 'hello@mgraph.us',
                name: 'MGraph',
              },
              template_id: 'd-6db6711d5a634a3db8bd43aa39e5ae96',
              personalizations: recipientEmails.map((email: string) => ({
                to: [{ email }],
                dynamic_template_data: {
                  commenter: commenter,
                  comment: latestComment.comment,
                  on_node: nodeName ? ` on ${nodeName}` : '',
                  cta_url: `${getBaseUrl()}/${nodeOrgName}/${nodeTypeName}s/${topicId}`,
                },
              })),
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
