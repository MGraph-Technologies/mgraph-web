import Link from 'next/link'
import React, { FunctionComponent } from 'react'

type SectionHeaderProps = {
  title: string
  size: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}
const SectionHeader: FunctionComponent<SectionHeaderProps> = ({
  title,
  size,
}) => {
  const sizeEmMap = {
    h1: 2.0,
    h2: 1.5,
    h3: 1.17,
    h4: 1.0,
    h5: 0.83,
    h6: 0.67,
  }
  const sectionId = title.toLowerCase().replace(' ', '-')
  return React.createElement(
    size,
    {
      id: sectionId,
      style: {
        fontSize: `${sizeEmMap[size]}em`,
        fontWeight: 'bold',
        marginTop: '1em',
        marginBottom: '0.5em',
      },
    },
    <Link href={`#${sectionId}`}>{title}</Link>
  )
}

export default SectionHeader
