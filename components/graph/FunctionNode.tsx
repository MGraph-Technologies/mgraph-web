import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { ColorResult } from 'react-color'
import 'react-edit-text/dist/index.css'
import { Handle, Position } from 'react-flow-renderer'

import styles from '../../styles/FunctionNode.module.css'
import { supabase } from '../../utils/supabaseClient'
import NodeMenu from './NodeMenu'

export async function getFunctionSymbol(
  functionTypeId: string
): Promise<string> {
  let _symbol = '?'
  try {
    let {
      data: queryData,
      error,
      status,
    } = await supabase
      .from('function_types')
      .select('symbol')
      .eq('id', functionTypeId)
      .is('deleted_at', null)

    if (error && status !== 406) {
      throw error
    }

    if (queryData) {
      _symbol = queryData[0].symbol
    }
  } catch (error: any) {
    alert(error.message)
  } finally {
    return _symbol
  }
}

export type FunctionNodeProperties = {
  id: string
  organizationId: string
  typeId: string
  functionTypeId: string
  color: string
  // below not in postgres
  initialProperties: object
  setNodeDataToChange: (data: FunctionNodeProperties) => void
}
type FunctionNodeProps = {
  data: FunctionNodeProperties
  selected: boolean
}
const FunctionNode: FunctionComponent<FunctionNodeProps> = ({
  data,
  selected,
}) => {
  const nodeHandleSize = '0px'

  const [symbol, setSymbol] = useState('')
  useEffect(() => {
    const populateSymbol = async () => {
      let _symbol = await getFunctionSymbol(data.functionTypeId)
      setSymbol(_symbol)
    }
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
      data.setNodeDataToChange(newData)
    },
    [data]
  )

  return (
    <div
      className={styles.function_node}
      style={{
        backgroundColor: color,
        border: selected ? '2px solid' : '1px solid',
      }}
    >
      <div className={styles.header}>
        <div className={styles.buttons}>
          <NodeMenu color={color} setColor={setColor} saveColor={saveColor} />
        </div>
      </div>
      <div className={styles.symbol}>{symbol}</div>
      <Handle
        type="source"
        id="top_source"
        position={Position.Top}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="right_source"
        position={Position.Right}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="bottom_source"
        position={Position.Bottom}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="source"
        id="left_source"
        position={Position.Left}
        style={{
          backgroundColor: 'Green',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="top_target"
        position={Position.Top}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="right_target"
        position={Position.Right}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="bottom_target"
        position={Position.Bottom}
        style={{
          backgroundColor: 'Red',
          width: nodeHandleSize,
          height: nodeHandleSize,
        }}
      />
      <Handle
        type="target"
        id="left_target"
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
