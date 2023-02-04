import { Button } from 'primereact/button'
import { OverlayPanel } from 'primereact/overlaypanel'
import React, { FunctionComponent, useRef, useState } from 'react'
import { ColorResult, TwitterPicker } from 'react-color'

import { useEditability } from '../../../contexts/editability'

type ColorPickerProps = {
  color: string
  onChangeComplete: (color: ColorResult) => void
}
const ColorPicker: FunctionComponent<ColorPickerProps> = ({
  color,
  onChangeComplete,
}) => {
  const { editingEnabled } = useEditability()
  const [displayColorPicker, setDisplayColorPicker] = useState(false)
  const pickerOverlayPanel = useRef<OverlayPanel>(null)
  return (
    <>
      {editingEnabled && (
        <>
          <Button
            id="toggle-color-picker-button"
            className="p-button-text p-button-lg"
            icon={displayColorPicker ? 'pi pi-times' : 'pi pi-palette'}
            onClick={(e) => {
              e.stopPropagation()
              pickerOverlayPanel.current?.toggle(e)
            }}
          />
          <OverlayPanel
            id="node-coloring-overlay"
            ref={pickerOverlayPanel}
            onShow={() => setDisplayColorPicker(true)}
            onHide={() => setDisplayColorPicker(false)}
          >
            <TwitterPicker
              color={color}
              onChangeComplete={onChangeComplete}
              triangle="hide"
              styles={{
                default: {
                  card: {
                    boxShadow: 'none',
                    border: 'none',
                  },
                },
              }}
            />
          </OverlayPanel>
        </>
      )}
    </>
  )
}

export default ColorPicker
