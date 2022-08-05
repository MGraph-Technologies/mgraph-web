import { Button } from 'primereact/button'
import { FunctionComponent, useCallback, useState } from 'react'
import { ColorResult, TwitterPicker } from 'react-color'

import { useEditability } from '../../contexts/editability'
import styles from '../../styles/NodeMenu.module.css'

type NodeMenuProps = {
  color: string
  setColor: (value: React.SetStateAction<string>) => void
  saveColor: (color: ColorResult) => void
}
const NodeMenu: FunctionComponent<NodeMenuProps> = ({
  color,
  setColor,
  saveColor,
}) => {
  const { editingEnabled } = useEditability()

  const [displayColorPicker, setDisplayColorPicker] = useState(false)
  const handleColorChangeComplete = useCallback(
    (color: ColorResult) => {
      setColor(color.hex)
      saveColor(color)
      setDisplayColorPicker(false)
    },
    [setColor, saveColor]
  )
  return (
    <div className={styles.menu}>
      {!editingEnabled ? (
        <Button
          className="p-button-text"
          icon="pi pi-angle-right"
          onClick={() => {}} // TODO: activate
        />
      ) : null}
      {editingEnabled && !displayColorPicker ? (
        <>
          <Button
            className="p-button-text"
            icon="pi pi-ellipsis-v"
            onClick={() => setDisplayColorPicker(true)}
          />
        </>
      ) : null}
      {editingEnabled && displayColorPicker ? (
        <>
          <TwitterPicker
            color={color}
            onChangeComplete={(color) => handleColorChangeComplete(color)}
          />
          <Button
            className="p-button-text"
            icon="pi pi-times"
            onClick={() => setDisplayColorPicker(false)}
          />
        </>
      ) : null}
    </div>
  )
}

export default NodeMenu
