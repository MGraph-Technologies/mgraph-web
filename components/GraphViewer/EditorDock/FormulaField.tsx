import { AutoComplete, AutoCompleteChangeParams } from 'primereact/autocomplete'
import React, { FunctionComponent, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { Graph } from '../GraphViewer'

type FormulaFieldProps = {
  graph: Graph
}
type NodeSymbol = {
  id: string // id of an existing or to-be-added node
  type: string
  display: string
}
const _FormulaField: FunctionComponent<FormulaFieldProps> = ({ graph }) => {
  const ref = useRef<AutoComplete>(null)
  const [formula, setFormula] = useState<NodeSymbol[]>([])
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<NodeSymbol[]>([])

  const metrics: NodeSymbol[] = graph.nodes
    .filter((node) => node.type === 'metric')
    .map((node) => {
      return { id: node.data.id, type: 'metric', display: node.data.name}
    })
  // TODO: load below from postgres
  const identities: NodeSymbol[] = [
    { id: uuidv4(), type: 'identity', display: '=' },
    { id: uuidv4(), type: 'identity', display: '~=' },
    { id: uuidv4(), type: 'identity', display: '=f(' },
  ]
  const operators: NodeSymbol[] = [
    // ids generated at selection time to allow multiple uses of the same symbol
    { id: 'tba', type: 'operator', display: '+' },
    { id: 'tba', type: 'operator', display: '-' },
    { id: 'tba', type: 'operator', display: '*' },
    { id: 'tba', type: 'operator', display: '/' },
  ]

  const filterSuggestions = (
    symbols: NodeSymbol[],
    query: string
  ): NodeSymbol[] => {
    let results: NodeSymbol[] = []
    if (query.length === 0) {
      results = [...symbols]
    } else {
      results = symbols.filter((symbol) => {
        return symbol.display.toLowerCase().includes(query.toLowerCase())
      })
    }
    results = results.filter((r) => 
        r.type !== 'metric' || !formula.find((f) => f.display === r.display)
    )
    results = results.map((r) => {
      if (r.type === 'operator') {
        return { ...r, id: uuidv4() }
      } else {
        return r
      }
    })
    results.sort((a, b) => {
      if (a.display < b.display) {
        return -1
      }
      if (a.display > b.display) {
        return 1
      }
      return 0
    })
    return results
  }
  const generateSuggestions = (event: { query: string }): void => {
    const toFilter: NodeSymbol[] = []
    // formula is of the form [metric] [identity] [metric] [operator] [metric] [operator] ...
    if (formula.length === 0 || formula[formula.length - 1].type !== 'metric') {
      toFilter.push(...metrics)
    } else if (formula.length === 1) {
      toFilter.push(...identities)
    } else {
      toFilter.push(...operators)
    }
    setSuggestions(filterSuggestions(toFilter, event.query))
  }
  const initializeSuggestions = (event: any): void => {
    // used to show suggestions before user starts typing
    ref.current?.search(event, '', 'dropdown')
  }

  const onChange = (event: AutoCompleteChangeParams): void => {
    setFormula(event.value)
    setTimeout(() => {
      // TODO: ideally this would be a side effect of changing the formula,
      // but I'm not sure how to get event to that
      initializeSuggestions(event.originalEvent)
    }, 100)
  }
  const onSelect = (event: AutoCompleteChangeParams): void => {
      setSelectedSymbolIds([...selectedSymbolIds, event.value.id])
      // primereact handles setFormula
  }
  const onUnselect = (event: AutoCompleteChangeParams): void => {
    const removedNodePosition = selectedSymbolIds.indexOf(event.value.id)
    const dependentNodes = selectedSymbolIds.filter((_id, index) => index >= removedNodePosition)
    setSelectedSymbolIds(selectedSymbolIds.filter((_id, index) => index < removedNodePosition))
    setFormula(formula.filter((f) => dependentNodes.indexOf(f.id) === -1)) // primereact handles removal of unselected node
  }

  return (
    <AutoComplete
      ref={ref}
      multiple={true}
      value={formula}
      field="display"
      suggestions={suggestions}
      completeMethod={generateSuggestions}
      onChange={onChange}
      onSelect={onSelect}
      onUnselect={onUnselect}
      dropdown={true}
      dropdownIcon="pi pi-plus"
      onClick={initializeSuggestions}
      autoHighlight={true}
      // forceSelection={true}
    />
  )
}

const FormulaField = React.memo(_FormulaField)
export default FormulaField
