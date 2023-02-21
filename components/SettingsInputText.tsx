import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import React, { FunctionComponent } from 'react'

import MentionField from 'components/MentionField'
import styles from 'styles/SettingsInputText.module.css'

type SettingsInputTextProps = {
  label: string
  value: string
  setValue: (value: string) => void
  tooltip?: string
  type?: string
  placeholder?: string
  onClick?: () => void
}
const SettingsInputText: FunctionComponent<SettingsInputTextProps> = ({
  label,
  value,
  setValue,
  tooltip,
  type = 'text',
  placeholder = '',
  onClick = () => {
    return
  },
}) => {
  const id = label.toLowerCase().replaceAll(' ', '-') + '-field'
  return (
    <div className={styles.settings_input_text_container}>
      <div>
        <label htmlFor={id} className={styles.settings_input_text_label}>
          {label}
        </label>
        {type === 'mentionableText' ? (
          <MentionField
            id={id}
            className={styles.settings_input_text_field}
            editable={true}
            value={value}
            setValue={setValue}
            placeholder={placeholder}
            onClick={onClick}
          />
        ) : (
          <InputText
            id={id}
            className={styles.settings_input_text_field}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
            }}
            type={type}
            placeholder={placeholder}
            onClick={onClick}
          />
        )}
      </div>
      {tooltip && (
        <Button
          className="p-button-text p-button-sm"
          icon="pi pi-info-circle"
          tooltip={tooltip}
          tooltipOptions={{
            position: 'left',
            style: { width: '500px' },
          }}
        />
      )}
    </div>
  )
}

export default SettingsInputText
