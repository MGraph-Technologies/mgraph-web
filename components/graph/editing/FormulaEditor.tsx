import { AutoComplete, AutoCompleteChangeParams } from 'primereact/autocomplete'
import { Button } from 'primereact/button'
import React, { FunctionComponent, useEffect, useRef, useState } from 'react'
import { Edge, Node } from 'react-flow-renderer'
import { v4 as uuidv4 } from 'uuid'

import { useGraph } from '../../../contexts/graph'
import { analytics } from '../../../utils/segmentClient'
import { supabase } from '../../../utils/supabaseClient'

type FormulaEditorProps = {
  setShowFormulaEditor: (value: React.SetStateAction<boolean>) => void
}
type NodeSymbol = {
  id: string // id of an existing or to-be-added node
  display: string
  functionTypeId: string | null
}
const _FormulaEditor: FunctionComponent<FormulaEditorProps> = ({
  setShowFormulaEditor,
}) => {
  const { graph, updateGraph, formFunctionNode, formInputEdge } = useGraph()
  const ref = useRef<AutoComplete>(null)
  const [formula, setFormula] = useState<NodeSymbol[]>([])
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<NodeSymbol[]>([])

  const variables: NodeSymbol[] = graph.nodes
    .filter((node) => node.type === 'metric' || node.type === 'mission')
    .map((node) => {
      return {
        id: node.data.id,
        display: node.type === 'mission' ? 'Mission' : node.data.name,
        functionTypeId: null,
      }
    })
  const [identities, setIdentities] = useState<NodeSymbol[]>([])
  const [operators, setOperators] = useState<NodeSymbol[]>([])
  async function populateFunctions() {
    try {
      let { data, error, status } = await supabase
        .from('function_types')
        .select('id, name, symbol')
        .is('deleted_at', null)

      if (error && status !== 406) {
        throw error
      }

      if (data) {
        const isIdentity = (symbol: string) => {
          return (
            symbol.startsWith('=') ||
            symbol.startsWith('~') ||
            symbol.startsWith('f')
          )
        }
        setIdentities(
          data
            .filter((item) => isIdentity(item.symbol))
            .map((item) => {
              return {
                id: uuidv4(),
                display: item.symbol,
                functionTypeId: item.id,
              }
            })
        )
        // ids generated at selection time to allow multiple uses of the same symbol
        setOperators(
          data
            .filter((item) => !isIdentity(item.symbol))
            .map((item) => {
              return {
                id: 'TBA',
                display: item.symbol,
                functionTypeId: item.id,
              }
            })
        )
      }
    } catch (error: any) {
      console.error(error.message)
    }
  }
  useEffect(() => {
    populateFunctions()
  }, [])

  const filterSuggestions = (
    symbols: NodeSymbol[],
    symbolsType: 'identity' | 'operator' | 'variable',
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
    results = results.filter(
      (r) =>
        symbolsType !== 'variable' ||
        !formula.find((f) => f.display === r.display)
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
    // formula is of the form [variable] [identity] [variable] [operator] [variable] [operator] ...
    if (formula.length === 0 || formula[formula.length - 1].functionTypeId) {
      setSuggestions(filterSuggestions(variables, 'variable', event.query))
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
    const dependentNodes = selectedSymbolIds.filter(
      (_id, index) => index >= removedNodePosition
    )
    setSelectedSymbolIds(
      selectedSymbolIds.filter((_id, index) => index < removedNodePosition)
    )
    setFormula(formula.filter((f) => dependentNodes.indexOf(f.id) === -1)) // primereact handles removal of unselected node
  }

  const onSave = (): void => {
    /* See here[1] for some diagrams related to the below algorithm, in which:
    1) we split formula into input symbols and output symbols
    2) for each operator in the inputs, we create a new function node and associated input edges
    3) finally, we create an identity function node and associated input edges
    
    Input edges always link functions to the variable on their right. The first function is linked
    to the variable on its left, while subsequent functions are linked to the previous function (so 
    that the formula is connected and parseable). All functions display shorthand linkage from the
    variable on their left to the variable on their right for readability.
    
    1: https://www.figma.com/file/nxWoiYjVROIJXmEPjN0JTI/MGraph-Function-Builder-Concept */
    if (!formFunctionNode) {
      throw new Error('formFunctionNode is not defined')
    }
    if (!formInputEdge) {
      throw new Error('formInputEdge is not defined')
    }
    if (!updateGraph) {
      throw new Error('updateGraph is not defined')
    }
    if (formula.length < 3) {
      analytics.track('save_formula_error', {
        type: 'formula_too_short',
      })
      alert('Formula should relate at least two variables')
      return
    }
    if (formula[formula.length - 1].functionTypeId) {
      analytics.track('save_formula_error', {
        type: 'formula_ends_with_function',
      })
      alert('Formula should end with a variable')
      return
    }

    let newFunctionNodes: Node[] = []
    let newInputEdges: Edge[] = []

    const outputSymbols = formula.slice(0, 2)
    const inputSymbols = formula.slice(2)
    for (let i = 0; i < inputSymbols.length; i++) {
      const inputSymbol = inputSymbols[i]
      if (inputSymbol.functionTypeId) {
        const leftVariable = graph.nodes.find(
          (node) => node.data.id === inputSymbols[i - 1].id
        )
        if (!leftVariable) {
          throw new Error('left variable not found')
        }
        const rightVariable = graph.nodes.find(
          (node) => node.data.id === inputSymbols[i + 1].id
        )
        if (!rightVariable) {
          throw new Error('right variable not found')
        }

        const newFunctionNode = formFunctionNode(
          inputSymbol.id,
          inputSymbol.functionTypeId,
          [leftVariable],
          rightVariable
        )
        newFunctionNodes.push(newFunctionNode)

        if (i === 1) {
          newInputEdges.push(formInputEdge(leftVariable, newFunctionNode))
        } else {
          const previousFunctionNode =
            newFunctionNodes[newFunctionNodes.length - 2]
          newInputEdges.push(
            formInputEdge(previousFunctionNode, newFunctionNode, leftVariable)
          )
        }

        newInputEdges.push(
          formInputEdge(
            rightVariable,
            newFunctionNode,
            newFunctionNode,
            rightVariable
          )
        )
      }
    }

    let outputVariableSymbol = outputSymbols[0]
    let outputVariable = graph.nodes.find(
      (node) => node.data.id === outputVariableSymbol.id
    )
    if (!outputVariable) {
      throw new Error('output variable not found')
    }
    let identitySymbol = outputSymbols[1]
    if (!identitySymbol.functionTypeId) {
      throw new Error('identity symbol is not a function')
    }

    let lastInputVariableSymbol = inputSymbols[inputSymbols.length - 1]
    let lastInputVariable = graph.nodes.find(
      (node) => node.data.id === lastInputVariableSymbol.id
    )
    if (!lastInputVariable) {
      throw new Error('last input variable not found')
    }

    const identityFunctionNode = formFunctionNode(
      identitySymbol.id,
      identitySymbol.functionTypeId,
      [lastInputVariable],
      outputVariable
    )
    newFunctionNodes.push(identityFunctionNode)

    newInputEdges.push(
      formInputEdge(
        newFunctionNodes.length >= 2
          ? newFunctionNodes[newFunctionNodes.length - 2]
          : lastInputVariable,
        identityFunctionNode,
        lastInputVariable
      ),
      formInputEdge(identityFunctionNode, outputVariable)
    )

    if (newFunctionNodes.length > 0 && newInputEdges.length > 0) {
      updateGraph(
        'all',
        [
          {
            nodes: graph.nodes.concat(newFunctionNodes),
            edges: graph.edges.concat(newInputEdges),
          },
        ],
        true
      )
      analytics.track('save_formula')
      setShowFormulaEditor(false)
    }
  }

  return (
    <div>
      <AutoComplete
        id="formula-field"
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
      />
      <Button id="save-formula-button" icon="pi pi-check" onClick={onSave} />
      <Button
        id="cancel-formula-button"
        icon="pi pi-times"
        onClick={(e) => {
          analytics.track('cancel_formula')
          setShowFormulaEditor(false)
        }}
      />
    </div>
  )
}

const FormulaEditor = React.memo(_FormulaEditor)
export default FormulaEditor
