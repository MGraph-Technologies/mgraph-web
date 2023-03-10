import { Edge, Node } from 'reactflow'

import { Graph } from 'contexts/graph'

export const getConnectedObjects = (
  graph: Graph,
  reference: Node | Edge,
  maxSeparationDegrees?: number,
  direction?: 'inputs' | 'outputs',
  connectedObjects: (Node | Edge)[] = []
) => {
  if (direction === undefined) {
    connectedObjects = connectedObjects.concat(
      getConnectedObjects(
        graph,
        reference,
        maxSeparationDegrees,
        'inputs',
        connectedObjects
      )
    )
    connectedObjects = connectedObjects.concat(
      getConnectedObjects(
        graph,
        reference,
        maxSeparationDegrees,
        'outputs',
        connectedObjects
      )
    )
  } else {
    if (reference.data.sourceId && reference.data.targetId) {
      // reference is edge
      // select connected nodes
      graph.nodes.forEach((node) => {
        if (
          ((node.id === reference.data.sourceId && direction === 'inputs') ||
            (node.id === reference.data.targetId && direction === 'outputs')) &&
          !connectedObjects.includes(node)
        ) {
          connectedObjects.push(node)
          if (
            maxSeparationDegrees !== undefined &&
            ['custom', 'metric'].includes(node.type || '')
          ) {
            maxSeparationDegrees -= 1
          }
          if (maxSeparationDegrees === undefined || maxSeparationDegrees > 0) {
            connectedObjects = getConnectedObjects(
              graph,
              node,
              maxSeparationDegrees,
              direction,
              connectedObjects
            )
          }
        }
      })
    } else {
      // reference is node
      // select connected edges
      graph.edges.forEach((edge) => {
        if (
          ((edge.data.sourceId === reference.id && direction === 'outputs') ||
            (edge.data.targetId === reference.id && direction === 'inputs')) &&
          !connectedObjects.includes(edge)
        ) {
          connectedObjects.push(edge)
          connectedObjects = getConnectedObjects(
            graph,
            edge,
            maxSeparationDegrees,
            direction,
            connectedObjects
          )
        }
      })
    }
  }
  // dedupe
  connectedObjects = connectedObjects.filter(
    (item, index) => connectedObjects.indexOf(item) === index
  )
  return connectedObjects
}
