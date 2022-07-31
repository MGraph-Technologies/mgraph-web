import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult } from 'react-color'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import NodeMenu from './NodeMenu'
import { useEditability } from '../../contexts/editability'
import styles from '../../styles/FunctionNode.module.css'
import { supabase } from '../../utils/supabaseClient'

export type FunctionNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  functionTypeId: string
  color: string
  // below not in postgres
  initialProperties: object
  setNodeDatatoChange: (data: FunctionNodeProperties) => void
}
type FunctionNodeProps = {
  data: FunctionNodeProperties
  selected: boolean
}
const FunctionNode: FunctionComponent<FunctionNodeProps> = ({ data, selected }) => {
  const { editingEnabled } = useEditability()
  const nodeHandleSize = editingEnabled ? '10px' : '0px'

  let symbol = ''
  async function populateSymbol() {
    try {
      let { data: queryData, error, status } = await supabase
        .from('function_types')
        .select('symbol')
        .eq('id', data.functionTypeId)

      if (error && status !== 406) {
        throw error
      }

      if (queryData) {
        symbol = queryData[0].symbol
      }
    } catch (error: any) {
      alert(error.message)
    }
  }
  useEffect(() => {
    populateSymbol()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) 

  const [color, setColor] = useState('#FFFFFF')
  useEffect(() => {
    setColor(data.color)
  }, [data.color])
  const saveColor = useCallback(
    (color: ColorResult) => {
      let newData = { ...data }
      newData.color = color.hex
      data.setNodeDatatoChange(newData)
    },
    [data]
  )

  return (
    <div
      className={styles.metric_node}
      style={{
        backgroundColor: color,
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div className={styles.header}>
        <div className={styles.buttons}>
          <NodeMenu
            color={color}
            setColor={setColor}
            saveColor={saveColor}
          />
        </div>
      </div>
      <div className={styles.symbol}>
        {symbol}
      </div>
      <Handle
        type="source"
        id="top"
        position={Position.Top}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="bottom"
        position={Position.Bottom}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
    </div>
  )
}

export default FunctionNode
