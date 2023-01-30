import {
  Chart as ChartJS,
  Legend,
  LegendItem,
  LinearScale,
  LineElement,
  PointElement,
  SubTitle,
  TimeScale,
  Tooltip,
} from 'chart.js'
import 'chartjs-adapter-moment'
import { Message } from 'primereact/message'
import { ProgressSpinner } from 'primereact/progressspinner'
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'

import { QueryError, QueryResult } from '../components/graph/QueryRunner'
import styles from '../styles/LineChart.module.css'
import { useAuth } from '../contexts/auth'
import { useQueries } from '../contexts/queries'
import {
  MetricData,
  QueryData,
  sortMetricRowsByDate,
  verifyMetricData,
} from '../utils/queryUtils'
import { supabase } from '../utils/supabaseClient'
import { GoalValue } from './graph/metric_detail/GoalsTable'

ChartJS.register(
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  SubTitle,
  TimeScale,
  Tooltip
)

type ChartJSDataset = {
  label: string
  data: {
    x: Date
    y: number | null
  }[]
  backgroundColor: string
  borderColor: string
  borderDash: number[]
  borderWidth: number
}

type LineChartProps = {
  parentMetricNodeId: string
  queryResult: QueryResult
  renderChart?: boolean
}
const LineChart: FunctionComponent<LineChartProps> = ({
  parentMetricNodeId,
  queryResult,
  renderChart = true,
}) => {
  const { organizationId, userOnMobile } = useAuth()
  const { queryParameters } = useQueries()
  const [metricData, setMetricData] = useState<MetricData | null>(null)
  const [chartJSDatasets, setChartJSDatasets] = useState<ChartJSDataset[]>([])
  const [chartJSDatasetsEnriched, setChartJSDatasetsEnriched] = useState(false)
  const [showNumberOverlay, setShowNumberOverlay] = useState(true)

  const makeChartJSDatasets = (metricData: MetricData) => {
    const { rows } = metricData
    const datasets: ChartJSDataset[] = []
    const SERIESCOLORS = [
      '#6466e9', // violet
      '#00635D', // green
      '#FFC800', // yellow
      '#DA7422', // orange
      '#E84855', // red
      '#787878', // grey
    ]
    const dimensions = Array.from(new Set(rows.map((row) => row[1])))
    dimensions.forEach((dimension, index) => {
      let dimensionRows = rows.filter((row) => row[1] === dimension)
      dimensionRows = sortMetricRowsByDate(dimensionRows)
      datasets.push({
        label: dimension,
        data: dimensionRows.map((row) => ({
          x: row[0],
          y: row[2],
        })),
        backgroundColor: SERIESCOLORS[index % SERIESCOLORS.length],
        borderColor: SERIESCOLORS[index % SERIESCOLORS.length],
        borderDash: [],
        borderWidth: 1,
      })
    })
    return datasets
  }

  useEffect(() => {
    const _metricData = verifyMetricData(queryResult.data as QueryData)
    setMetricData(_metricData)
    if (_metricData) {
      setChartJSDatasets(makeChartJSDatasets(_metricData))
    } else {
      setChartJSDatasets([])
    }
    setChartJSDatasetsEnriched(false)
  }, [queryResult])

  const enrichChartJSDatasets = useCallback(async () => {
    if (chartJSDatasets.length === 0) return
    const frequency = queryParameters.frequency?.userValue
    const dimensionName = queryParameters.group_by?.userValue
    // first date across all datasets
    const firstPlottedDate = chartJSDatasets
      .reduce((acc, dataset) => {
        const firstPlottedDate = dataset.data[0].x
        return firstPlottedDate < acc ? firstPlottedDate : acc
      }, new Date())
      .toISOString()
    // last date across all datasets
    const lastPlottedDate = chartJSDatasets
      .reduce((acc, dataset) => {
        const lastPlottedDate = dataset.data[dataset.data.length - 1].x
        return lastPlottedDate > acc ? lastPlottedDate : acc
      }, new Date(0))
      .toISOString()
    if (
      organizationId &&
      parentMetricNodeId &&
      frequency &&
      dimensionName &&
      firstPlottedDate &&
      lastPlottedDate
    ) {
      const { data: goalsData, error: goalsError } = await supabase
        .from('columnar_goals')
        .select('dimension_value, values')
        // match organization, parent node, freqency
        .match({
          organization_id: organizationId,
          parent_node_id: parentMetricNodeId,
          frequency: frequency,
        })
        // match dimension name
        // the or filter is, as far as I know, the only way to pass a conditionally-written condition
        .or(
          dimensionName.toLowerCase() === 'null' // query parameters aren't case-sensitive
            ? 'dimension_name.is.null'
            : `dimension_name.eq.${dimensionName}`
        )
        // goal date range overlaps with chart date range
        .gte('last_date', firstPlottedDate)
        .lte('first_date', lastPlottedDate)

      if (goalsError) {
        console.error(goalsError)
        return
      }

      if (goalsData && goalsData.length > 0) {
        // create goal datasets for each row whose dimension_name is in chartJSData,
        // matching color of actual but with dotted line
        const goalsDatasets = goalsData
          .map((goalData) => {
            const goalDimensionValue = goalData.dimension_value
            const correspondingChartJSDataset = chartJSDatasets.find(
              (dataset) => {
                return dataset.label === goalDimensionValue
              }
            )
            if (!correspondingChartJSDataset) {
              return null
            } else {
              const goalValues = goalData.values as GoalValue[]
              const goalDataset: ChartJSDataset = {
                label: `${goalDimensionValue} - goal`,
                data: goalValues.map((goalValue) => ({
                  x: new Date(goalValue.date),
                  y: Number(goalValue.value),
                })),
                backgroundColor: 'transparent',
                borderColor: correspondingChartJSDataset.backgroundColor,
                borderDash: [5, 5],
                borderWidth: 1,
              }
              return goalDataset
            }
          })
          .filter((dataset) => dataset !== null) as ChartJSDataset[]
        if (goalsDatasets.length === 0) {
          return
        }
        // mark actual datasets with 'actual' label
        const actualDatasets = chartJSDatasets.map((dataset) => {
          dataset.label = `${dataset.label} - actual`
          return dataset
        })
        // if only 'null - actual' and 'null - goal', rename to 'actual' and 'goal'
        if (
          actualDatasets.length === 1 &&
          goalsDatasets.length === 1 &&
          actualDatasets[0].label === 'null - actual' &&
          goalsDatasets[0].label === 'null - goal'
        ) {
          actualDatasets[0].label = 'actual'
          goalsDatasets[0].label = 'goal'
        }
        setChartJSDatasets([...actualDatasets, ...goalsDatasets])
      }
    }
  }, [chartJSDatasets, queryParameters, organizationId, parentMetricNodeId])

  useEffect(() => {
    if (chartJSDatasets.length > 0 && !chartJSDatasetsEnriched) {
      enrichChartJSDatasets()
      setChartJSDatasetsEnriched(true)
    }
  }, [chartJSDatasets, chartJSDatasetsEnriched, enrichChartJSDatasets])

  const centerStyle = {
    margin: 'auto',
    width: '100%',
  }
  switch (queryResult.status) {
    case 'unexecuted':
      return (
        <Message
          severity="info"
          text="Query not yet executed; refresh query to view chart."
          style={centerStyle}
        />
      )
    case 'unauthorized':
      return (
        <Message
          severity="error"
          text="Unauthorized to view query result."
          style={centerStyle}
        />
      )
    case 'success':
      if (chartJSDatasets.length === 0) {
        return (
          <Message
            severity="error"
            text="Query result should be of format date | dimension | value."
            style={centerStyle}
          />
        )
      } else {
        const numberToOverlay =
          chartJSDatasets.filter((dataset) => {
            const label = dataset.label || ''
            return !label.endsWith('goal')
          }).length === 1
            ? // last non-null value
              Number(
                chartJSDatasets[0].data.reverse().find((d) => d.y !== null)?.y
              )
            : null
        const numberToOverlayString =
          numberToOverlay !== null
            ? numberToOverlay >= 1000 || numberToOverlay <= -1000
              ? numberToOverlay.toLocaleString().slice(0, 17)
              : numberToOverlay.toString().slice(0, 17)
            : null
        return (
          <>
            <div
              className={styles.chart_container}
              onMouseOver={() => setShowNumberOverlay(false)}
              onMouseOut={() => setShowNumberOverlay(true)}
            >
              {showNumberOverlay && numberToOverlayString ? ( // show number overlay if only one series
                <div className={styles.number_overlay}>
                  {numberToOverlayString}
                </div>
              ) : null}
              {renderChart ? (
                <Line
                  data={{
                    datasets: chartJSDatasets,
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: {
                        type: 'time',
                      },
                    },
                    plugins: {
                      subtitle: {
                        display: true,
                        text: 'Last updated: ' + metricData?.executedAt,
                        position: 'bottom',
                        align: 'end',
                      },
                      legend:
                        chartJSDatasets.length > 1
                          ? {
                              position: 'bottom',
                              labels: {
                                // deduplicate dataset labels
                                // needed in case of multiple goal series for same dimension
                                generateLabels: (chart) => {
                                  const firstLabeledDatasets =
                                    chart.data.datasets.filter((dataset, i) => {
                                      return (
                                        chart.data.datasets.findIndex(
                                          (d) => d.label === dataset.label
                                        ) === i
                                      )
                                    })
                                  return firstLabeledDatasets.map((dataset) => {
                                    return {
                                      text: dataset.label,
                                      strokeStyle: dataset.borderColor,
                                      fillStyle: dataset.backgroundColor,
                                      hidden: false,
                                    } as LegendItem
                                  })
                                },
                              },
                            }
                          : { display: false },
                    },
                  }}
                />
              ) : null}
            </div>
          </>
        )
      }
    case 'processing':
      return (
        <div className={styles.progress_spinner_container}>
          {userOnMobile ? (
            <>Loading...</>
          ) : (
            <ProgressSpinner style={centerStyle} strokeWidth="4" />
          )}
        </div>
      )
    case 'parent_unsaved':
      return (
        <Message
          severity="info"
          text="Save metric and define source to view chart."
          style={centerStyle}
        />
      )
    case 'parent_empty':
      return (
        <Message
          severity="info"
          text="Define source to view chart."
          style={centerStyle}
        />
      )
    case 'expired':
      return (
        <Message
          severity="info"
          text="Query result has expired; refresh query to view chart."
          style={centerStyle}
        />
      )
    case 'error':
      // eslint-disable-next-line no-case-declarations
      const queryError = queryResult.data as QueryError
      return (
        <Message
          severity="error"
          text={
            queryError
              ? typeof queryError === 'string'
                ? queryError
                : JSON.stringify(queryError)
              : 'An error occurred.'
          }
          style={centerStyle}
        />
      )
  }
}

export default LineChart
