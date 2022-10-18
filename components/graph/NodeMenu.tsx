import { Button } from 'primereact/button'
import { FunctionComponent, useCallback, useState } from 'react'
import { ColorResult, TwitterPicker } from 'react-color'

import { useEditability } from '../../contexts/editability'
import { useBrowser } from '../../contexts/browser'
import styles from '../../styles/NodeMenu.module.css'

type NodeMenuProps = {
  color: string
  setColor: (value: React.SetStateAction<string>) => void
  saveColor: (color: ColorResult) => void
  linkTo?: string
}
const NodeMenu: FunctionComponent<NodeMenuProps> = ({
  color,
  setColor,
  saveColor,
  linkTo = '',
}) => {
  const { editingEnabled } = useEditability()
  const { push } = useBrowser()

  const [displayColorPicker, setDisplayColorPicker] = useState(false)
  const handleColorChangeComplete = useCallback(
    (color: ColorResult) => {
      setColor(color.hex)
      saveColor(color)
    },
    [setColor, saveColor]
  )

  return (
    <div className={styles.menu_container}>
      {editingEnabled && !displayColorPicker ? (
        <>
          <Button
            id="expand-node-menu-button"
            className="p-button-text p-button-lg"
            icon="pi pi-palette"
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
            id="close-node-coloring-button"
            className="p-button-text p-button-lg"
            icon="pi pi-times"
            onClick={() => setDisplayColorPicker(false)}
          />
        </>
      ) : null}
      {linkTo ? (
        <Button
          id="link-to-detail-button"
          className="p-button-text p-button-lg"
          icon="pi pi-angle-right"
          onClick={() => {
            if (editingEnabled) {
              // entire node is clickable if editing is disabled
              push(linkTo)
            }
          }}
        />
      ) : null}
    </div>
  )
}

export default NodeMenu
