import { Button } from 'primereact/button'
import {
  Column,
  ColumnEditorOptions,
  ColumnEditorType,
  ColumnEventParams,
} from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { FunctionComponent } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { useEditability } from 'contexts/editability'

export type UserInputTableColumn = {
  name: string
  type: 'string' | 'number' | 'date'
}
export type UserInputTableRow = { [key: string]: string | number | null }
type UserInputTableProps = {
  columns: UserInputTableColumn[]
  rows: UserInputTableRow[]
  setRows: React.Dispatch<React.SetStateAction<UserInputTableRow[]>>
  sortable?: false | 'single' | 'multiple'
}
const UserInputTable: FunctionComponent<UserInputTableProps> = ({
  columns,
  rows,
  setRows,
  sortable = false,
}) => {
  const { editingEnabled } = useEditability()

  const editors: { [key: string]: ColumnEditorType } = {
    string: (options: ColumnEditorOptions) => {
      return (
        <InputText
          type="text"
          value={options.value as string}
          onChange={(e) => options.editorCallback?.(e.target.value)}
        />
      )
    },
    number: (options: ColumnEditorOptions) => {
      return (
        <InputNumber
          value={options.value as number}
          onValueChange={(e) => options.editorCallback?.(e.value)}
          locale="en-US"
          mode="decimal"
          maxFractionDigits={16}
        />
      )
    },
    date: (options: ColumnEditorOptions) => {
      return (
        <InputText
          type="text"
          /* "date" / "datetime-local" inputs were erroneously rerendering on input;
            I'm calling time box and using a text input + parsing below for now */
          value={options.value as string}
          onChange={(e) => options.editorCallback?.(e.target.value)}
        />
      )
    },
  }

  const onCellEditComplete = (e: ColumnEventParams) => {
    const { rowData, field, newValue } = e
    setRows((prevRows) => {
      const attemptDateParse = (str: string) => {
        const date = new Date(str)
        return !isNaN(date.getTime())
          ? new Date(
              // interpret entered date as UTC
              date.getTime() - date.getTimezoneOffset() * 60000
            ).toISOString()
          : str
      }
      const newRows = [...prevRows]
      const rowIdx = newRows.findIndex(
        (row) => row['id'] === (rowData as UserInputTableRow)['id']
      )
      newRows[rowIdx] = {
        ...newRows[rowIdx],
        [field]: field === 'date' ? attemptDateParse(newValue) : newValue,
      }
      return newRows
    })
  }

  const addRow = () => {
    setRows((prevRows) => [
      ...prevRows,
      columns.reduce(
        (acc, col) => {
          acc[col.name] =
            col.type === 'number'
              ? 0
              : col.type === 'date'
              ? // today at midnight
                new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
              : ''
          return acc
        },
        {
          id: uuidv4(),
        } as UserInputTableRow
      ),
    ])
  }

  const deleteRow = (row: UserInputTableRow) => {
    setRows((prevRows) => prevRows.filter((r) => r !== row))
  }

  return (
    <>
      <DataTable
        value={rows}
        editMode={editingEnabled ? 'cell' : 'none'}
        className={editingEnabled ? 'editable-cells-table' : ''}
        emptyMessage="Click '+' to add a row"
        sortMode={sortable ? sortable : undefined}
      >
        {columns.map((col) => (
          <Column
            key={col.name}
            header={col.name}
            field={col.name}
            editor={editingEnabled ? editors[col.type] : undefined}
            onCellEditComplete={onCellEditComplete}
            style={{
              width:
                Math.round((editingEnabled ? 90 : 100) / columns.length) + '%',
            }}
            sortable={sortable !== false}
          />
        ))}
        {editingEnabled && (
          <Column
            body={(rowData) => (
              <Button
                icon="pi pi-trash"
                className="p-button-text p-button-lg"
                onClick={() => deleteRow(rowData as UserInputTableRow)}
              />
            )}
            style={{ width: '10%' }}
          />
        )}
      </DataTable>
      {editingEnabled && (
        <div
          style={{ display: 'flex', justifyContent: 'right', padding: '1rem' }}
        >
          <Button icon="pi pi-plus" onClick={addRow} />
        </div>
      )}
    </>
  )
}

export default UserInputTable
