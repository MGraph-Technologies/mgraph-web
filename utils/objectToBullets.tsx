import { ReactNode } from 'react'

export const objectToBullets = (obj: object): ReactNode => {
  const propertyBullets = Object.entries(obj).map(([key, val]) => {
    let valStr = typeof val === 'string' ? val : JSON.stringify(val)
    if (valStr.length > 50) {
      valStr = `${valStr.substring(0, 50)}...`
    }
    return (
      <li key={key}>
        <strong>{key}:</strong> {valStr}
      </li>
    )
  })
  return <ul>{propertyBullets}</ul>
}
