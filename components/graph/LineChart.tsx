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
import { FunctionComponent, useCallback, useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'

import {
  GoalStatus,
  GoalType,
  GoalValue,
} from 'components/graph/node_detail/GoalsTable'
import LoadingWheelOverlay from 'components/graph/LoadingWheelOverlay'
import { QueryError, QueryResult } from 'components/graph/QueryRunner'
import { useAuth } from 'contexts/auth'
import { useGraph } from 'contexts/graph'
import { useQueries } from 'contexts/queries'
import styles from 'styles/LineChart.module.css'
import { MetricData, QueryData } from 'utils/queryUtils'
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

export type ChartJSDatapoint = {
  x: Date
  y: number | null
}
type ChartJSDataset = {
  label: string
  data: ChartJSDatapoint[]
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
  const { organizationId } = useAuth()
  const { graph, setGoalStatusMap } = useGraph()
  const { inputParameters } = useQueries()
  const [chartJSDatasets, setChartJSDatasets] = useState<ChartJSDataset[]>([])
  const [chartJSDatasetsLoaded, setChartJSDatasetsLoaded] = useState(false)
  const [displayNumberOverlay, setDisplayNumberOverlay] = useState(true)
  const [numberToOverlay, setNumberToOverlay] = useState<number | null>(null)
  const [queryResultVerified, setQueryResultVerified] = useState(false)
  const [yMax, setYMax] = useState<number | undefined>(undefined)
  const [yMin, setYMin] = useState<number | undefined>(undefined)

  useEffect(() => {
    const parentMetricNode = graph.nodes.find(
      (node) => node.id === parentMetricNodeId
    )
    if (parentMetricNode) {
      const yMin = parentMetricNode.data.chartSettings?.yMin
      const yMax = parentMetricNode.data.chartSettings?.yMax
      setYMin(yMin)
      setYMax(yMax)
    }
  }, [graph.nodes, parentMetricNodeId])

  /***** Process Query Result for Plotting *****/
  const makeInitialChartJSDatasets = useCallback((metricData: MetricData) => {
    const { metricDimensionsData } = metricData
    const datasets: ChartJSDataset[] = []
    const SERIESCOLORS = [
      '#6466e9', // violet
      '#00635D', // green
      '#FFC800', // yellow
      '#DA7422', // orange
      '#E84855', // red
      '#787878', // grey
    ]
    const dimensions = Array.from(metricDimensionsData.keys())
    dimensions.forEach((dimension, index) => {
      datasets.push({
        label: dimension,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        data: metricDimensionsData.get(dimension)!,
        backgroundColor: SERIESCOLORS[index % SERIESCOLORS.length],
        borderColor: SERIESCOLORS[index % SERIESCOLORS.length],
        borderDash: [],
        borderWidth: 1,
        goalInfo: null,
      })
    })
    return datasets
  }, [])

  const makeEnrichedChartJSDatasets: (
    initialChartJSDatasets: ChartJSDataset[]
  ) => Promise<ChartJSDataset[] | null> = useCallback(
    async (initialChartJSDatasets) => {
      const earlyReturn = () => {
        return null
      }

      /* query for goals */
      const frequency = inputParameters.frequency?.userValue as string | null
      const dimensionName = inputParameters.group_by?.userValue as string | null
      // first date across all datasets
      const firstPlottedDate = initialChartJSDatasets
        .reduce((acc, dataset) => {
          // points come sorted from query results endpoint
          const _firstPlottedDate = dataset.data[0].x
          return _firstPlottedDate < acc ? _firstPlottedDate : acc
        }, new Date(9999, 11, 31))
        .toISOString()
      // last date across all datasets
      const lastPlottedDate = initialChartJSDatasets
        .reduce((acc, dataset) => {
          // points come sorted from query results endpoint
          const _lastPlottedDate = dataset.data[dataset.data.length - 1].x
          return _lastPlottedDate > acc ? _lastPlottedDate : acc
        }, new Date(0, 1, 1))
        .toISOString()
      if (
        !(
          organizationId &&
          parentMetricNodeId &&
          frequency &&
          dimensionName &&
          firstPlottedDate &&
          lastPlottedDate
        )
      ) {
        earlyReturn()
      }
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
          dimensionName?.toLowerCase() === 'null' // input parameters aren't case-sensitive
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
        earlyReturn()
      }
      if (!goalsData || goalsData.length === 0) {
        earlyReturn()
      }

      /* create goal datasets for each row whose dimension_name is in chartJSData,
        matching color of actual but with dotted line */
      const goals = goalsData as {
        id: string
        dimension_value: string
        values: GoalValue[]
        type: GoalType
      }[]
      const goalsDatasets = goals
        .map((goal) => {
          const goalDimensionValue = goal.dimension_value
          const correspondingChartJSDataset = initialChartJSDatasets.find(
            (dataset) => {
              return dataset.label === goalDimensionValue
            }
          )
          if (!correspondingChartJSDataset) {
            return null
          } else {
            const goalDataset: ChartJSDataset = {
              label: `${goalDimensionValue} - goal`,
              data: goal.values.map((goalValue) => ({
                x: new Date(goalValue.date),
                y: Number(goalValue.value),
              })),
              backgroundColor: 'transparent',
              borderColor: correspondingChartJSDataset.backgroundColor,
              borderDash: [5, 5],
              borderWidth: 1,
              goalInfo: {
                id: goal.id,
                type: goal.type,
              },
            }
            return goalDataset
          }
        })
        .filter((dataset) => dataset !== null) as ChartJSDataset[]
      if (goalsDatasets.length === 0) {
        earlyReturn()
      }

      /* merge actual and goal datasets */
      // mark actual datasets with 'actual' label
      const actualDatasets = initialChartJSDatasets.map((dataset) => {
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
      return [...actualDatasets, ...goalsDatasets]
    },
    [inputParameters, organizationId, parentMetricNodeId]
  )

  useEffect(() => {
    setChartJSDatasetsLoaded(false)
  }, [queryResult])
  useEffect(() => {
    const loadData = async () => {
      if (!(queryResult.status === 'success')) return
      const data = queryResult.data as MetricData | QueryData
      const _queryResultVerified = Boolean(data && data.metricDataVerified)
      setQueryResultVerified(_queryResultVerified)
      if (_queryResultVerified) {
        const metricData = data as MetricData
        const initialChartJSDatasets = makeInitialChartJSDatasets(metricData)
        const _numberToOverlay =
          initialChartJSDatasets.length === 1
            ? // last non-null value
              Number(
                // points come sorted from query results endpoint
                initialChartJSDatasets[0].data
                  .filter((d) => d.y !== null)
                  .slice(-1)[0]?.y
              )
            : null
        setNumberToOverlay(_numberToOverlay)
        const enrichedChartJSDatasets = await makeEnrichedChartJSDatasets(
          initialChartJSDatasets
        )
        setChartJSDatasets(enrichedChartJSDatasets || initialChartJSDatasets)
      } else {
        setChartJSDatasets([])
        setNumberToOverlay(null)
      }
      setChartJSDatasetsLoaded(true)
    }
    if (!chartJSDatasetsLoaded) {
      loadData()
    }
  }, [
    queryResult,
    makeInitialChartJSDatasets,
    makeEnrichedChartJSDatasets,
    chartJSDatasetsLoaded,
  ])

  /***** Evaluate Plotted Goals *****/
  const [goalStatusMapUpdated, setGoalStatusMapUpdated] = useState(false)
  useEffect(() => {
    setGoalStatusMapUpdated(false)
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
      type DataPoint = { x: Date; y: number }
      const mostRecentActualDataPoint = actualDataset.data
        .filter((dataPoint) => {
          return dataPoint.y !== null
        })
        .slice()
        .sort((a, b) => {
          return b.x.getTime() - a.x.getTime()
        })[0] as DataPoint | undefined
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
            })[0] as DataPoint | undefined
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
            })[0] as DataPoint | undefined
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
            })[0] as DataPoint | undefined
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
            })[0] as DataPoint | undefined
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
    setGoalStatusMapUpdated(true)
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
      if (!chartJSDatasetsLoaded) {
        return <LoadingWheelOverlay />
      } else {
        if (queryResultVerified) {
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
                onMouseOver={() => setDisplayNumberOverlay(false)}
                onMouseOut={() => setDisplayNumberOverlay(true)}
              >
                {displayNumberOverlay && numberToOverlayString ? ( // show number overlay if only one series
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
                      animation: false,
                      maintainAspectRatio: false,
                      responsive: true,
                      scales: {
                        x: {
                          type: 'time',
                        },
                        y: {
                          min: yMin,
                          max: yMax,
                        },
                      },
                      plugins: {
                        subtitle: {
                          display: true,
                          text:
                            'Last updated: ' +
                            (queryResult.data as MetricData).executedAt,
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
                                      chart.data.datasets.filter(
                                        (dataset, i) => {
                                          return (
                                            chart.data.datasets.findIndex(
                                              (d) => d.label === dataset.label
                                            ) === i
                                          )
                                        }
                                      )
                                    return firstLabeledDatasets.map(
                                      (dataset) => {
                                        return {
                                          text: dataset.label,
                                          strokeStyle: dataset.borderColor,
                                          fillStyle: dataset.backgroundColor,
                                          hidden: false,
                                        } as LegendItem
                                      }
                                    )
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
        } else {
          return (
            <Message
              severity="error"
              text="Query result should be of format date | dimension | value."
              style={centerStyle}
            />
          )
        }
      }
    case 'processing':
      return <LoadingWheelOverlay />
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
