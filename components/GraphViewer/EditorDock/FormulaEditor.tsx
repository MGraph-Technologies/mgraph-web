import { AutoComplete, AutoCompleteChangeParams } from 'primereact/autocomplete'
import { Button } from 'primereact/button'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'
import { Node } from 'react-flow-renderer'
import { v4 as uuidv4 } from 'uuid'

import { Graph } from '../GraphViewer'
import { supabase } from '../../../utils/supabaseClient'

type FormulaEditorProps = {
  graph: Graph
  updateGraph: (t: 'nodes' | 'edges', v: Array<any>, undoable: boolean) => void
  formFunctionNode: (newNodeId: string, functionTypeId: string, inputNodeId: string, outputNodeId: string) => Node<any> | undefined
  setShowFormulaEditor: (value: React.SetStateAction<boolean>) => void
}
type NodeSymbol = {
  id: string // id of an existing or to-be-added node
  display: string,
  functionTypeId: string | null
}
const _FormulaEditor: FunctionComponent<FormulaEditorProps> = ({ 
  graph,
  updateGraph,
  formFunctionNode,
  setShowFormulaEditor
}) => {
  const ref = useRef<AutoComplete>(null)
  const [formula, setFormula] = useState<NodeSymbol[]>([])
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<NodeSymbol[]>([])

  const metrics: NodeSymbol[] = graph.nodes
    .filter((node) => node.type === 'metric')
    .map((node) => {
      return { id: node.data.id, display: node.data.name, functionTypeId: null }
    })
  const [identities, setIdentities] = useState<NodeSymbol[]>([])
  const [operators, setOperators] = useState<NodeSymbol[]>([])
  async function populateFunctions() {
    try {
      let { data, error, status } = await supabase
        .from('function_types')
        .select('id, name, symbol')

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        const isIdentity = (symbol: string) => {
          return (
            symbol.startsWith('=')
              || symbol.startsWith('~')
              || symbol.startsWith('f')
          )
        }
        setIdentities(
          data.filter((item) => isIdentity(item.symbol)).map((item) => {
            return { id: uuidv4(), display: item.symbol, functionTypeId: item.id }
          })
        )
        // ids generated at selection time to allow multiple uses of the same symbol
        setOperators(
          data.filter((item) => !isIdentity(item.symbol)).map((item) => {
            return { id: 'TBA', display: item.symbol, functionTypeId: item.id }
          })
        )
      }
    } catch (error: any) {
      alert(error.message)
    }
  }
  useEffect(() => {
    populateFunctions()
  }, [])

  const filterSuggestions = (
    symbols: NodeSymbol[],
    symbolsType: 'identity' | 'operator' | 'metric',
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
        symbolsType !== 'metric' || !formula.find((f) => f.display === r.display)
    )
    results = results.map((r) => {
      if (symbolsType === 'operator') {
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
    // formula is of the form [metric] [identity] [metric] [operator] [metric] [operator] ...
    if (formula.length === 0 || formula[formula.length - 1].functionTypeId) {
      setSuggestions(filterSuggestions(metrics, 'metric', event.query))
    } else if (formula.length === 1) {
      setSuggestions(filterSuggestions(identities, 'identity', event.query))
    } else {
      setSuggestions(filterSuggestions(operators, 'operator', event.query))
    }
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

  const onSave = (): void => {
    let newNodes: Node[] = []
    formula.forEach((ns, index) => {
      if (ns.functionTypeId) {
        const inputNodeId = formula[index - 1].id
        const outputNodeId = formula[index + 1].id
        const newNode = formFunctionNode(ns.id, ns.functionTypeId, inputNodeId, outputNodeId)
        if (newNode) {
          newNodes.push(newNode)
        }
      }
    })
    if (newNodes.length > 0) {
      updateGraph('nodes', graph.nodes.concat(newNodes), true)
      setShowFormulaEditor(false)
    }
  }

  return (
    <div>
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
      <Button
        icon="pi pi-check"
        onClick={onSave}/>
      <Button
        icon="pi pi-times"
        onClick={(e) => setShowFormulaEditor(false)}
      />
    </div>
  )
}

const FormulaEditor = React.memo(_FormulaEditor)
export default FormulaEditor
