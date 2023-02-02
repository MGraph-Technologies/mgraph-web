import { FunctionComponent } from 'react'

import styles from '../styles/SettingsRadioGroup.module.css'

type SettingsRadioGroupOption = {
  label: string
  value: string
}
type SettingsRadioGroupProps = {
  id: string
  value: string
  options: SettingsRadioGroupOption[]
  onChange: (newValue: string) => void
  disabled?: boolean
}
const SettingsRadioGroup: FunctionComponent<SettingsRadioGroupProps> = ({
  id,
  value,
  options,
  onChange,
  disabled = false,
}) => {
  return (
    <div id={id} className={styles.radio_group}>
      {options.map((option) => (
        <div key={option.value} className={styles.radio_group_item}>
          {/* using stock input rather than RadioButton since the latter messes up workspace for some reason */}
          <input
            id={`${id}-${option.value}`}
            className={styles.radio_group_item_input}
            type="radio"
            name={id}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          <label
            htmlFor={`${id}-${option.value}`}
            className={styles.radio_group_item_label}
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  )
}

export default SettingsRadioGroup
