import {
  Chart as ChartJS,
  Legend,
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
import { FunctionComponent, useState } from 'react'
import { Line } from 'react-chartjs-2'

import {
  QueryColumn,
  QueryData,
  QueryError,
  QueryResult,
  QueryRow,
} from '../components/graph/QueryRunner'
import styles from '../styles/LineChart.module.css'
import { useAuth } from '../contexts/auth'
import {
  checkColumnsStructure,
  sortQueryRowsByDate,
  snowflakeDateToJsDate,
} from '../utils/queryUtils'

ChartJS.register(
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  SubTitle,
  TimeScale,
  Tooltip
)

type LineChartProps = {
  queryResult: QueryResult
  renderChart?: boolean
}
const LineChart: FunctionComponent<LineChartProps> = ({
  queryResult,
  renderChart = true,
}) => {
  const { userOnMobile } = useAuth()
  const [showNumberOverlay, setShowNumberOverlay] = useState(true)

  const makeChartJsDatasets = (columns: QueryColumn[], rows: QueryRow[]) => {
    const datasets: {
      label: string
      data: { x: Date; y: number | null }[]
      backgroundColor: string
      borderColor: string
      borderWidth: number
    }[] = []
    const SERIESCOLORS = [
      '#6466e9', // violet
      '#00635D', // green
      '#FFC800', // yellow
      '#DA7422', // orange
      '#E84855', // red
      '#787878', // grey
    ]
    const dimensions = Array.from(new Set(rows.map((row: QueryRow) => row[1])))
    dimensions.forEach((dimension, index) => {
      let dimensionRows = rows.filter((row: QueryRow) => row[1] === dimension)
      dimensionRows = sortQueryRowsByDate(dimensionRows)
      datasets.push({
        label: dimension,
        data: dimensionRows.map((row: QueryRow) => ({
          x: snowflakeDateToJsDate(row[0]),
          y: row[2] !== 'None' ? parseFloat(row[2]) : null,
        })),
        backgroundColor: SERIESCOLORS[index % SERIESCOLORS.length],
        borderColor: SERIESCOLORS[index % SERIESCOLORS.length],
        borderWidth: 1,
      })
    })
    return datasets
  }

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
      // eslint-disable-next-line no-case-declarations
      const queryData = queryResult.data as QueryData
      if (
        !queryData ||
        !queryData.columns ||
        !queryData.rows ||
        !checkColumnsStructure(queryData)
      ) {
        return (
          <Message
            severity="error"
            text="Query result should be of format date | dimension | value."
            style={centerStyle}
          />
        )
      } else {
        const datasets = makeChartJsDatasets(queryData.columns, queryData.rows)
        const numberToOverlay =
          datasets.length === 1
            ? // last non-null value
              Number(datasets[0].data.reverse().find((d) => d.y !== null)?.y)
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
                    datasets: datasets,
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
                        text: 'Last updated: ' + queryData.executedAt,
                        position: 'bottom',
                        align: 'end',
                      },
                      legend:
                        datasets.length > 1
                          ? { position: 'bottom' }
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
