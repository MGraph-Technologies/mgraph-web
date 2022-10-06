import { useRouter } from 'next/router'
import { FilterMatchMode } from 'primereact/api'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import {
  DataTable,
  DataTableFilterMeta,
  DataTablePFSEvent,
  DataTableSortOrderType,
} from 'primereact/datatable'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'

import { useAuth } from '../../contexts/auth'
import { useGraph } from '../../contexts/graph'
import styles from '../../styles/GraphTable.module.css'
import { analytics } from '../../utils/segmentClient'
import LineChart from '../LineChart'
import QueryRunner, { QueryResult } from '../QueryRunner'
import ControlPanel from './ControlPanel'

type GraphTableProps = {}
const GraphTable: FunctionComponent<GraphTableProps> = () => {
  const { graph, getInputNodes } = useGraph()
  const { organizationId, organizationName } = useAuth()

  const [metricsTableLoading, setMetricsTableLoading] = useState(true)
  const [metrics, setMetrics] = useState<any[]>([])
  const populateMetrics = useCallback(() => {
    if (organizationId) {
      setMetricsTableLoading(true)
      let _nodes = graph.nodes.filter((node) => node.type === 'metric')
      _nodes.forEach(
        (node) =>
          (node.data = {
            ...node.data,
            numInputMetrics: getInputNodes!(node).filter(
              (inputNode) => inputNode.type === 'metric'
            ).length,
          })
      )
      setMetrics(_nodes)
      setMetricsTableLoading(false)
    }
  }, [organizationId, graph, getInputNodes])
  useEffect(() => {
    populateMetrics()
  }, [populateMetrics])

  type TrendCellBodyTemplateProps = {
    rowData: any
  }
  const TrendCellBodyTemplateFC: FunctionComponent<
    TrendCellBodyTemplateProps
  > = ({ rowData }) => {
    const [queryResult, setQueryResult] = useState<QueryResult>({
      status:
        !rowData ||
        !rowData.data.sourceCode ||
        !rowData.data.sourceDatabaseConnectionId
          ? 'empty'
          : 'processing',
      data: null,
    })
    return (
      <div className={styles.chart_container}>
        <QueryRunner
          statement={rowData?.data.sourceCode}
          databaseConnectionId={rowData?.data.sourceDatabaseConnectionId}
          parentNodeId={rowData?.data.id}
          refreshes={0}
          queryResult={queryResult}
          setQueryResult={setQueryResult}
        />
        <LineChart queryResult={queryResult} />
      </div>
    )
  }
  const trendCellBodyTemplate = (rowData: any) => {
    return <TrendCellBodyTemplateFC rowData={rowData} />
  }

  const infoCellBodyTemplate = (rowData: any) => {
    return (
      <Button
        id="link-to-detail-button"
        className="p-button-text p-button-lg"
        icon="pi pi-info-circle"
        tooltip={`Description: ${rowData.data.description}
          \nOwner: ${rowData.data.owner}`}
        tooltipOptions={{
          position: 'left',
          style: { width: '500px' },
        }}
        onMouseEnter={(e) => {
          analytics.track('view_tooltip', {
            nodeId: rowData.data.id,
          })
        }}
      />
    )
  }

  const router = useRouter()
  const linkCellBodyTemplate = (rowData: any) => {
    return (
      <Button
        id="link-to-detail-button"
        className="p-button-text p-button-lg"
        icon="pi pi-angle-right"
        onClick={() => {
          router.push(`/${organizationName}/metrics/${rowData.id}`)
        }}
      />
    )
  }

  const [first, setFirst] = useState(0)
  const onPage = (e: DataTablePFSEvent) => {
    analytics.track('change_table_page', {
      table: 'graph',
      page: e.page,
      first: e.first,
    })
    setFirst(e.first)
  }

  const [filters, setFilters] = useState<DataTableFilterMeta>({
    'data.name': {
      value: null,
      matchMode: FilterMatchMode.CONTAINS,
    },
  })
  const onFilter = (e: DataTablePFSEvent) => {
    for (let key in e.filters) {
      const newFilter: any = e.filters[key]
      const oldFilter: any = filters[key]
      if (
        !oldFilter ||
        oldFilter.value !== newFilter.value ||
        oldFilter.matchMode !== newFilter.matchMode
      ) {
        analytics.track('filter_table', {
          table: 'graph',
          key: key,
          value: newFilter.value,
          matchMode: newFilter.matchMode,
        })
      }
    }
    setFilters({
      ...filters,
      ...e.filters,
    })
  }

  const [sortField, setSortField] = useState('data.numInputMetrics')
  const [sortOrder, setSortOrder] = useState<DataTableSortOrderType>(-1)
  const onSort = (e: DataTablePFSEvent) => {
    analytics.track('sort_table', {
      table: 'graph',
      sortField: e.sortField,
      sortOrder: e.sortOrder,
    })
    setSortField(e.sortField)
    setSortOrder(e.sortOrder)
  }

  return (
    <div className={styles.graph_table_container}>
      <div className={styles.control_panel_container}>
        <ControlPanel hideEditButton={true} />
      </div>
      <DataTable
        paginator
        scrollable
        scrollHeight="flex"
        scrollDirection="vertical"
        value={metrics}
        loading={metricsTableLoading}
        rows={10}
        onRowClick={(e) => {
          router.push(`/${organizationName}/metrics/${e.data.id}`)
        }}
        paginatorTemplate="FirstPageLink PrevPageLink NextPageLink LastPageLink CurrentPageReport"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
        paginatorPosition="bottom"
        first={first}
        onPage={onPage}
        filterDisplay="row"
        filters={filters}
        onFilter={onFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        emptyMessage="No metrics found"
      >
        <Column
          field="data.name"
          header="Metric"
          style={{ maxWidth: '25%' }}
          sortable
          filter
          filterPlaceholder="Search"
          showFilterMenu={false}
        />
        <Column
          field="data.numInputMetrics"
          header="# of Inputs"
          style={{ maxWidth: '5%' }}
          sortable
        />
        <Column body={trendCellBodyTemplate} style={{ minWidth: '50%' }} />
        <Column
          body={infoCellBodyTemplate}
          align="center"
          style={{ maxWidth: '5%' }}
        />
        <Column
          body={linkCellBodyTemplate}
          align="center"
          style={{ maxWidth: '5%' }}
        />
      </DataTable>
    </div>
  )
}

export default GraphTable
