import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { Node } from 'reactflow'

import QueryRunner, { QueryResult } from '../../components/graph/QueryRunner'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/GraphTable.module.css'
import { analytics } from '../../utils/segmentClient'
import ControlPanel from './ControlPanel'
import LineChart from './LineChart'
import EditorDock from './editing/EditorDock'
import NodePanel from './nodepanel/NodePanel'

type GraphTableProps = {
  metricNodes: Node[]
  expansionLevel?: number
}
const GraphTable: FunctionComponent<GraphTableProps> = ({
  metricNodes,
  expansionLevel = 0,
}) => {
  const { getConnectedObjects } = useGraph()

  const [metrics, setMetrics] = useState<Node[]>([])
  useEffect(() => {
    const _metrics = metricNodes.map((node) => {
      return {
        ...node,
        data: {
          ...node.data,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          numInputMetrics: getConnectedObjects!(
            node,
            undefined,
            'inputs'
          ).filter((inputNode) => inputNode.type === 'metric').length,
        },
      }
    })
    setMetrics(_metrics)
  }, [metricNodes, getConnectedObjects])

  const [inputMetrics, setInputMetrics] = useState<{ [key: string]: Node[] }>(
    {}
  )
  useEffect(() => {
    const _inputMetrics: { [key: string]: Node[] } = {}
    metricNodes.forEach((node) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      _inputMetrics[node.id] = getConnectedObjects!(node, 1, 'inputs')
        .filter((inputObject) => inputObject.type === 'metric')
        .map((inputNode) => inputNode as Node)
    })
    setInputMetrics(_inputMetrics)
  }, [metricNodes, getConnectedObjects])

  const rowExpansionTemplate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      return (
        <GraphTable
          metricNodes={inputMetrics[rowData.id]}
          expansionLevel={expansionLevel + 1}
        />
      )
    },
    [inputMetrics, expansionLevel]
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [expandedRows, setExpandedRows] = useState<any>(null)
  // initially expand previously-expanded rows, or top-level with children
  const [initialExpansionComplete, setInitialExpansionComplete] =
    useState(false)
  useEffect(() => {
    if (metrics.length > 0 && !initialExpansionComplete) {
      const prevGraphTableExpandedRowIds = localStorage.getItem(
        `graphTableExpandedRowIds${expansionLevel}`
      )
      if (prevGraphTableExpandedRowIds !== null) {
        setExpandedRows(
          metrics.filter((metric) =>
            JSON.parse(prevGraphTableExpandedRowIds).includes(metric.id)
          )
        )
      } else if (expansionLevel === 0) {
        setExpandedRows(metrics.filter((metric) => metric.data.numInputMetrics))
      }
      setInitialExpansionComplete(true)
    }
  }, [metrics, initialExpansionComplete, expansionLevel])
  useEffect(() => {
    if (!initialExpansionComplete) return
    const newGraphTableExpandedRowIds = JSON.stringify(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expandedRows ? expandedRows.map((rowData: any) => rowData.id) : []
    )
    localStorage.setItem(
      `graphTableExpandedRowIds${expansionLevel}`,
      newGraphTableExpandedRowIds
    )
  }, [initialExpansionComplete, expandedRows, expansionLevel])

  const expandOrCollapseRow = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      if (
        expandedRows &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expandedRows.some((row: any) => row.id === rowData.id)
      ) {
        analytics.track('collapse_graph_table_row', {
          id: rowData.id,
        })
        setExpandedRows(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expandedRows.filter((row: any) => row.id !== rowData.id)
        )
      } else {
        analytics.track('expand_graph_table_row', {
          id: rowData.id,
        })
        const _expandedRows = expandedRows
          ? expandedRows.concat(rowData)
          : [rowData]
        setExpandedRows(_expandedRows)
      }
    },
    [expandedRows, setExpandedRows]
  )
  const onRowClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (e.data.data.numInputMetrics > 0) {
        expandOrCollapseRow(e.data)
      }
    },
    [expandOrCollapseRow]
  )
  // DIY since primereact's expander column prop isn't accepting a conditional display function
  const expandCollapseCellBodyTemplate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rowData: any) => {
      const showButton = rowData.data.numInputMetrics > 0
      // do it this way to maintain consistent column alignment
      return (
        <Button
          id="expand-collapse-button"
          className="p-button-text p-button-lg"
          icon={
            showButton
              ? expandedRows &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                expandedRows.some((row: any) => row.id === rowData.id)
                ? 'pi pi-angle-down'
                : 'pi pi-angle-right'
              : ''
          }
          onClick={() => {
            expandOrCollapseRow(rowData)
          }}
          disabled={!showButton}
        />
      )
    },
    [expandedRows, expandOrCollapseRow]
  )

  type TrendCellBodyTemplateProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rowData: any
  }
  const TrendCellBodyTemplateFC: FunctionComponent<
    TrendCellBodyTemplateProps
  > = ({ rowData }) => {
    const [queryResult, setQueryResult] = useState<QueryResult>({
      status: 'processing',
      data: null,
    })
    return (
      <div className={styles.chart_container}>
        <QueryRunner
          parentMetricNodeData={rowData.data}
          refreshes={0}
          queryResult={queryResult}
          setQueryResult={setQueryResult}
        />
        <LineChart parentMetricNodeId={rowData.id} queryResult={queryResult} />
      </div>
    )
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trendCellBodyTemplate = useCallback((rowData: any) => {
    return <TrendCellBodyTemplateFC rowData={rowData} />
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodePanelCellBodyTemplate = useCallback((rowData: any) => {
    return <NodePanel nodeId={rowData.id} />
  }, [])

  return (
    <div
      className={styles.graph_table_container}
      style={{
        borderLeft: expansionLevel > 0 ? `1px solid #e0e0e0` : 'none',
        marginLeft: `${expansionLevel * 10}px`,
      }}
    >
      {expansionLevel === 0 && (
        <>
          <div className={styles.control_panel_container}>
            <ControlPanel />
          </div>
          <EditorDock parent="GraphTable" />
        </>
      )}
      <DataTable
        value={metrics}
        rowExpansionTemplate={rowExpansionTemplate}
        expandedRows={expandedRows}
        onRowClick={onRowClick}
        headerColumnGroup={<></>}
        footerColumnGroup={<></>}
        emptyMessage={
          expansionLevel === 0
            ? 'No output metrics defined'
            : 'This metric has no inputs'
        }
      >
        <Column
          body={expandCollapseCellBodyTemplate}
          align="center"
          style={{ width: '5%' }}
        />
        <Column
          field="data.name"
          header="Metric"
          align="left"
          style={{ width: '15%' }}
        />
        <Column
          body={trendCellBodyTemplate}
          align="center"
          style={{ width: '60%' }}
        />
        <Column
          body={nodePanelCellBodyTemplate}
          align="right"
          style={{ width: '20%' }}
        />
      </DataTable>
    </div>
  )
}

const GraphTableViewer: FunctionComponent = () => {
  const { graph, getConnectedObjects } = useGraph()

  const [topLevelMetricNodes, setTopLevelMetricNodes] = useState<Node[]>([])
  useEffect(() => {
    if (graph && getConnectedObjects) {
      let _topLevelMetricNodes: Node[] = []
      // attempt to sort by tablePosition
      _topLevelMetricNodes = graph.nodes.filter((node) => {
        return node.type === 'metric' && node.data.tablePosition
      })
      _topLevelMetricNodes.sort((a, b) => {
        return a.data.tablePosition - b.data.tablePosition
      })
      if (_topLevelMetricNodes.length === 0) {
        // fall back to output metrics if top level not manually defined
        _topLevelMetricNodes = graph.nodes.filter((node) => {
          return (
            node.type === 'metric' &&
            getConnectedObjects(node, 1, 'outputs').filter(
              (outputObject) => outputObject.type === 'metric'
            ).length === 0
          )
        })
      }
      setTopLevelMetricNodes(_topLevelMetricNodes)
    }
  }, [graph, getConnectedObjects])

  return <GraphTable metricNodes={topLevelMetricNodes} expansionLevel={0} />
}

export default GraphTableViewer
