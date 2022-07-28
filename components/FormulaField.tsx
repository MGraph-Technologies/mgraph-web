
import { AutoComplete, AutoCompleteChangeParams } from 'primereact/autocomplete';
import React, { FunctionComponent, useRef, useState } from 'react'

import { Graph } from '../components/GraphViewer'

type FormulaFieldProps = {
  graph: Graph
}
type FormulaSymbol = {
  id: string,
  display: string,
  type: string,
}
const FormulaField: FunctionComponent<FormulaFieldProps> = ({ graph }) => {
  const ref = useRef<AutoComplete>(null)
  const [formula, setFormula] = useState<FormulaSymbol[]>([])
  const [suggestions, setSuggestions] = useState<FormulaSymbol[]>([])

  const metrics: FormulaSymbol[] = graph.nodes.filter(node => node.type === 'metric').map(node => {
    return {'id': node.data.id, 'display': node.data.name, 'type': 'metric'}
  })
  const identities: FormulaSymbol[] = [
    {'id': '1', 'display': '=', type: 'identity',},
    {'id': '2', 'display': '~=', type: 'identity',},
    {'id': '3', 'display': '=f(', type: 'identity',},
  ]
  const operators: FormulaSymbol[] = [
    {'id': '1', 'display': '+', type: 'operator',},
    {'id': '2', 'display': '-', type: 'operator',},
    {'id': '3', 'display': '*', type: 'operator',},
    {'id': '4', 'display': '/', type: 'operator',},
  ]
  
  const filterSuggestions = (symbols: FormulaSymbol[], query: string): FormulaSymbol[] => {
    let results: FormulaSymbol[] = []
    if (query.length === 0) {
      results = [...symbols]
    } else {
      results = symbols.filter(symbol => {
        return symbol.display.toLowerCase().includes(query.toLowerCase())
      })
    } 
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
    const toFilter: FormulaSymbol[] = []
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
    ref.current?.search(event, "", "dropdown")
  }

  const onChange = (event: AutoCompleteChangeParams): void => {
    setFormula(event.value)
    setTimeout(() => {
      // TODO: ideally this would be a side effect of changing the formula,
      // but I'm not sure how to get event to that
      initializeSuggestions(event.originalEvent)
    }, 100)
  }
  
  return (
    <AutoComplete
      ref={ref}
      multiple={true}
      value={formula}
      field='display'
      suggestions={suggestions}
      completeMethod={generateSuggestions}
      onChange={onChange}
      dropdown={true}
      dropdownIcon="pi pi-plus"
      onClick={initializeSuggestions}
      autoHighlight={true}
      // forceSelection={true}
    />
  )
}

export default FormulaField