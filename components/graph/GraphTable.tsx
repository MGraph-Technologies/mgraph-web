import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { Node } from 'react-flow-renderer'

import { useAuth } from '../../contexts/auth'
import { useGraph } from '../../contexts/graph'
import { useBrowser } from '../../contexts/browser'
import styles from '../../styles/GraphTable.module.css'
import { analytics } from '../../utils/segmentClient'
import LineChart from '../LineChart'
import QueryRunner, { QueryResult } from '../QueryRunner'
import ControlPanel from './ControlPanel'
import NodeInfoButton from './NodeInfoButton'

type GraphTableProps = {
  metricNodes: Node[]
  expansionLevel?: number
}
const GraphTable: FunctionComponent<GraphTableProps> = ({
  metricNodes,
  expansionLevel = 0,
}) => {
  const { getConnectedObjects } = useGraph()
  const { organizationName } = useAuth()
  const { push } = useBrowser()

  const [metrics, setMetrics] = useState<Node[]>([])
  useEffect(() => {
    const _metrics = metricNodes.map((node) => {
      return {
        ...node,
        data: {
          ...node.data,
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
      _inputMetrics[node.id] = getConnectedObjects!(node, 1, 'inputs')
        .filter((inputObject) => inputObject.type === 'metric')
        .map((inputNode) => inputNode as Node)
    })
    setInputMetrics(_inputMetrics)
  }, [metricNodes, getConnectedObjects])

  const rowExpansionTemplate = useCallback(
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
  const [expandedRows, setExpandedRows] = useState<any>(null)
  // initially expand previously-expanded rows, or top-level
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
        setExpandedRows(metrics)
      }
      setInitialExpansionComplete(true)
    }
  }, [metrics, initialExpansionComplete, expansionLevel])
  useEffect(() => {
    if (!initialExpansionComplete) return
    const newGraphTableExpandedRowIds = JSON.stringify(
      expandedRows ? expandedRows.map((rowData: any) => rowData.id) : []
    )
    localStorage.setItem(
      `graphTableExpandedRowIds${expansionLevel}`,
      newGraphTableExpandedRowIds
    )
  }, [initialExpansionComplete, expandedRows, expansionLevel])

  const expandOrCollapseRow = useCallback(
    (rowData: any) => {
      if (
        expandedRows &&
        expandedRows.some((row: any) => row.id === rowData.id)
      ) {
        analytics.track('collapse_graph_table_row', {
          id: rowData.id,
        })
        setExpandedRows(
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
    (e: any) => {
      if (e.data.data.numInputMetrics > 0) {
        expandOrCollapseRow(e.data)
      }
    },
    [expandOrCollapseRow]
  )
  // DIY since primereact's expander column prop isn't accepting a conditional display function
  const expandCollapseCellBodyTemplate = useCallback(
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
        <LineChart queryResult={queryResult} />
      </div>
    )
  }
  const trendCellBodyTemplate = useCallback((rowData: any) => {
    return <TrendCellBodyTemplateFC rowData={rowData} />
  }, [])

  const infoCellBodyTemplate = useCallback((rowData: any) => {
    return <NodeInfoButton nodeData={rowData.data} />
  }, [])

  const linkCellBodyTemplate = useCallback(
    (rowData: any) => {
      return (
        <Button
          id="link-to-detail-button"
          className="p-button-text p-button-lg"
          icon="pi pi-angle-right"
          onClick={() => {
            push(`/${organizationName}/metrics/${rowData.id}`)
          }}
        />
      )
    },
    [push, organizationName]
  )

  return (
    <div
      className={styles.graph_table_container}
      style={{
        borderLeft: expansionLevel > 0 ? `1px solid #e0e0e0` : 'none',
        marginLeft: `${expansionLevel * 10}px`,
      }}
    >
      {expansionLevel === 0 && (
        <div className={styles.control_panel_container}>
          <ControlPanel />
        </div>
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
        <Column body={expandCollapseCellBodyTemplate} align="center" />
        <Column field="data.name" header="Metric" />
        <Column body={trendCellBodyTemplate} style={{ width: '50%' }} />
        <Column body={infoCellBodyTemplate} align="center" />
        <Column body={linkCellBodyTemplate} align="center" />
      </DataTable>
    </div>
  )
}

type GraphTableViewerProps = {}
const GraphTableViewer: FunctionComponent<GraphTableViewerProps> = () => {
  const { graph, getConnectedObjects } = useGraph()

  const [outputMetricNodes, setOutputMetricNodes] = useState<Node[]>([])
  useEffect(() => {
    if (graph && getConnectedObjects) {
      setOutputMetricNodes(
        graph.nodes.filter((node) => {
          return (
            node.type === 'metric' &&
            getConnectedObjects(node, 1, 'outputs').filter(
              (outputObject) => outputObject.type === 'metric'
            ).length === 0
          )
        })
      )
    }
  }, [graph, getConnectedObjects])

  return <GraphTable metricNodes={outputMetricNodes} expansionLevel={0} />
}

export default GraphTableViewer
