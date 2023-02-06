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

import {
  GoalStatus,
  GoalType,
  GoalValue,
} from 'components/graph/node_detail/GoalsTable'
import { QueryError, QueryResult } from 'components/graph/QueryRunner'
import { useAuth } from 'contexts/auth'
import { useGraph } from 'contexts/graph'
import { useQueries } from 'contexts/queries'
import styles from 'styles/LineChart.module.css'
import {
  MetricData,
  QueryData,
  sortMetricRowsByDate,
  verifyMetricData,
} from 'utils/queryUtils'
import { supabase } from 'utils/supabaseClient'

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
  goalInfo: {
    id: string
    type: GoalType
  } | null
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
  const { setGoalStatusMap } = useGraph()
  const { queryParameters } = useQueries()
  const [metricData, setMetricData] = useState<MetricData | null>(null)
  const [chartJSDatasets, setChartJSDatasets] = useState<ChartJSDataset[]>([])
  const [numberToOverlay, setNumberToOverlay] = useState<number | null>(null)
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
        goalInfo: null,
      })
    })
    return datasets
  }

  useEffect(() => {
    const _metricData = verifyMetricData(queryResult.data as QueryData)
    setMetricData(_metricData)
    if (_metricData) {
      const _chartJSDatasets = makeChartJSDatasets(_metricData)
      setChartJSDatasets(_chartJSDatasets)
      const _numberToOverlay =
        _chartJSDatasets.length === 1
          ? // last non-null value
            Number(
              _chartJSDatasets[0].data.reverse().find((d) => d.y !== null)?.y
            )
          : null
      setNumberToOverlay(_numberToOverlay)
    } else {
      setChartJSDatasets([])
      setNumberToOverlay(null)
    }
    setChartJSDatasetsEnriched(false)
  }, [queryResult])

  /***** Plot Goals On Chart *****/
  const enrichChartJSDatasets = useCallback(async () => {
    if (chartJSDatasets.length === 0) return
    if (chartJSDatasetsEnriched) return
    const frequency = queryParameters.frequency?.userValue
    const dimensionName = queryParameters.group_by?.userValue
    // first date across all datasets
    const firstPlottedDate = chartJSDatasets
      .reduce((acc, dataset) => {
        // avoid inplace sort triggering chart rerender
        const data = dataset.data.slice()
        const _firstPlottedDate = data.sort(
          (a, b) => a.x.getTime() - b.x.getTime()
        )[0].x
        return _firstPlottedDate < acc ? _firstPlottedDate : acc
      }, new Date(9999, 11, 31))
      .toISOString()
    // last date across all datasets
    const lastPlottedDate = chartJSDatasets
      .reduce((acc, dataset) => {
        const data = dataset.data.slice()
        const _lastPlottedDate = data.sort(
          (a, b) => b.x.getTime() - a.x.getTime()
        )[0].x
        return _lastPlottedDate > acc ? _lastPlottedDate : acc
      }, new Date(0, 1, 1))
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
        .select('id, dimension_value, values, type')
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
        // goal is not deleted
        .is('deleted_at', null)

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
                goalInfo: {
                  id: goalData.id,
                  type: goalData.type,
                },
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
        setChartJSDatasetsEnriched(true)
      }
    }
  }, [
    chartJSDatasets,
    chartJSDatasetsEnriched,
    queryParameters,
    organizationId,
    parentMetricNodeId,
  ])

  useEffect(() => {
    enrichChartJSDatasets()
  }, [enrichChartJSDatasets])

  /***** Evaluate Plotted Goals *****/
  const [goalStatusMapUpdated, setGoalStatusesUpdated] = useState(false)
  useEffect(() => {
    setGoalStatusesUpdated(false)
  }, [chartJSDatasets])
  const updateGoalStatusMap: () => void = useCallback(() => {
    // only evaluate in case of 1+ actual and 1+ goal datasets
    const actualDatasets = chartJSDatasets.filter((dataset) => {
      return dataset.goalInfo === null
    })
    const goalDatasets = chartJSDatasets.filter((dataset) => {
      return dataset.goalInfo !== null
    })
    if (actualDatasets.length === 0 || goalDatasets.length === 0) {
      return
    }

    const localGoalStatusMap: { [goalId: string]: GoalStatus } = {}
    const goalSuccess = (
      goalType: GoalType,
      goalValue: number,
      actualValue: number
    ): boolean => {
      switch (goalType) {
        case 'increase':
          return actualValue >= goalValue
        case 'decrease':
          return actualValue <= goalValue
      }
    }
    // evaluate each actual dataset's goals
    actualDatasets.forEach((actualDataset) => {
      // only evaluate if actual dataset has at least 1 non-null data point
      const mostRecentActualDataPoint = actualDataset.data
        .filter((dataPoint) => {
          return dataPoint.y !== null
        })
        .slice()
        .sort((a, b) => {
          return b.x.getTime() - a.x.getTime()
        })[0] as { x: Date; y: number } | undefined
      if (!mostRecentActualDataPoint) {
        return
      }

      // evaluate each goal dataset
      goalDatasets.forEach((goalDataset) => {
        const goalInfo = goalDataset.goalInfo
        if (!goalInfo) return
        const goalId = goalInfo.id
        const goalType = goalInfo.type
        const goalData = goalDataset.data
        const firstGoalDate = goalData[0].x
        const lastGoalDate = goalData[goalData.length - 1].x

        // if goal is in the future, move on
        if (firstGoalDate > mostRecentActualDataPoint.x) {
          return
        }

        // if goal is ongoing, compare most recent actual datapoint to goal line
        if (lastGoalDate > mostRecentActualDataPoint.x) {
          const closestLTEGoalDataPoint = goalData
            .filter((dataPoint) => {
              return (
                dataPoint.y !== null &&
                dataPoint.x <= mostRecentActualDataPoint.x
              )
            })
            .slice()
            .sort((a, b) => {
              return b.x.getTime() - a.x.getTime()
            })[0] as { x: Date; y: number } | undefined
          const closestGTEGoalDataPoint = goalData
            .filter((dataPoint) => {
              return (
                dataPoint.y !== null &&
                dataPoint.x >= mostRecentActualDataPoint.x
              )
            })
            .slice()
            .sort((a, b) => {
              return a.x.getTime() - b.x.getTime()
            })[0] as { x: Date; y: number } | undefined
          if (!closestLTEGoalDataPoint || !closestGTEGoalDataPoint) {
            return
          }

          // compare
          const comparisonGoalValue =
            closestLTEGoalDataPoint.y +
            (closestLTEGoalDataPoint.x === closestGTEGoalDataPoint.x
              ? 0
              : (closestGTEGoalDataPoint.y - closestLTEGoalDataPoint.y) *
                ((mostRecentActualDataPoint.x.getTime() -
                  closestLTEGoalDataPoint.x.getTime()) /
                  (closestGTEGoalDataPoint.x.getTime() -
                    closestLTEGoalDataPoint.x.getTime())))
          localGoalStatusMap[goalId] = goalSuccess(
            goalType,
            comparisonGoalValue,
            mostRecentActualDataPoint.y
          )
            ? 'ahead'
            : 'behind'
          return
        }

        // if goal has concluded, compare last goal datapoint to on-or-before actual datapoint
        if (lastGoalDate <= mostRecentActualDataPoint.x) {
          const lastGoalDataPoint = goalData
            .filter((dataPoint) => {
              return dataPoint.y !== null
            })
            .slice()
            .sort((a, b) => {
              return b.x.getTime() - a.x.getTime()
            })[0] as { x: Date; y: number } | undefined
          if (!lastGoalDataPoint) {
            return
          }

          const comparisonActualValue = actualDataset.data
            .filter((dataPoint) => {
              return (
                dataPoint.y !== null &&
                dataPoint.x.getTime() <= lastGoalDataPoint.x.getTime()
              )
            })
            .slice()
            .sort((a, b) => {
              return b.x.getTime() - a.x.getTime()
            })[0] as { x: Date; y: number } | undefined
          if (!comparisonActualValue) {
            return
          }
          localGoalStatusMap[goalId] = goalSuccess(
            goalType,
            lastGoalDataPoint.y,
            comparisonActualValue.y
          )
            ? 'achieved'
            : 'missed'
          return
        }
      })
      setGoalStatusMap?.((prevGSM) => {
        return {
          ...prevGSM,
          [parentMetricNodeId]: localGoalStatusMap,
        }
      })
    })
    setGoalStatusesUpdated(true)
  }, [chartJSDatasets, setGoalStatusMap, parentMetricNodeId])
  useEffect(() => {
    if (!goalStatusMapUpdated) {
      updateGoalStatusMap()
    }
  }, [goalStatusMapUpdated, updateGoalStatusMap])

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
