import { Mention, MentionItemTemplateType } from 'primereact/mention'
import React, { FunctionComponent, useState } from 'react'

import { useEditability } from '../contexts/editability'
import { supabase } from '../utils/supabaseClient'
import UserAvatar from './UserAvatar'

type MentionFieldProps = {
  id: string
  className: string
  value: string
  setValue: (value: string) => void
  placeholder?: string
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>
  onBlur?: (event: React.FocusEvent<HTMLInputElement, Element>) => void
}
const MentionField: FunctionComponent<MentionFieldProps> = ({
  id,
  className,
  value,
  setValue,
  placeholder,
  onClick,
  onBlur,
}) => {
  const { editingEnabled } = useEditability()
  type Mention = {
    id: string
    name: string
    email: string
    username: string
    avatarUrl: string
  }
  const [mentionSuggestions, setMentionSuggestions] = useState<Mention[]>([])
  const [mentionQuery, setMentionQuery] = useState('')
  const suggestMentions = async (event: { query: string }) => {
    const { query } = event
    if (!query) return
    setMentionQuery(query)
    const { data, error } = await supabase
      .from('sce_display_users')
      .select('id, name, email, avatar')
      .or(
        `email.ilike.${query.toLowerCase()}%,name.ilike.${query.toLowerCase()}%`
      )
      .limit(10)

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      setMentionSuggestions(
        data.map((owner) => ({
          id: owner.id,
          name: owner.name,
          email: owner.email,
          username: owner.email.split('@')[0],
          avatarUrl: owner.avatar,
        }))
      )
    } else {
      setMentionSuggestions([])
    }
  }
  const mentionSuggestionTemplate: MentionItemTemplateType = (suggestion) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: '32px' }}>
          <UserAvatar
            user={{
              name: suggestion.name as string,
              email: suggestion.email as string,
              avatarUrl: suggestion.avatarUrl as string,
            }}
          />
        </div>
        <div style={{ marginLeft: '.5rem' }}>
          <p>{suggestion.name}</p>
          <small
            style={{ fontSize: '.75rem', color: 'var(--text-secondary-color)' }}
          >
            {suggestion.username}
          </small>
        </div>
      </div>
    )
  }

  return editingEnabled ? (
    <Mention
      id={id}
      autoResize
      className={className}
      inputClassName={className}
      value={value}
      placeholder={placeholder}
      suggestions={mentionSuggestions}
      itemTemplate={mentionSuggestionTemplate}
      field="username"
      delay={300}
      onSearch={suggestMentions}
      onSelect={(e) => {
        // Manual insertion, since default leaves divergent query text after selection
        const usernameToInsert = e.suggestion.username
        const newValue = value.replace(
          `@${mentionQuery}`,
          `@${usernameToInsert} `
        )
        setValue(newValue)
      }}
      onChange={(e) => {
        const target = e.target as HTMLInputElement
        setValue(target.value)
      }}
      onClick={onClick}
      onBlur={onBlur}
    />
  ) : (
    <div
      className={className}
      dangerouslySetInnerHTML={{
        __html: value.replaceAll(
          /@[a-zA-Z0-9_.+-]+/g,
          (match) =>
            `<span class='at_mention' style='border: 1px solid #c2c2c2; border-radius: 5px; padding: 0 3px'>${match}</span>`
        ),
      }}
    />
  )
}

export default MentionField
