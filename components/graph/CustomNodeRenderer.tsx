import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Node } from 'reactflow'

import { useGraph } from 'contexts/graph'
import styles from 'styles/CustomNodeRenderer.module.css'

type CustomNodeRendererProps = {
  parentCustomNodeId: string
  shouldRender?: boolean
  expandHeight?: boolean
}
const CustomNodeRenderer: FunctionComponent<CustomNodeRendererProps> = ({
  parentCustomNodeId,
  shouldRender = true,
  expandHeight = false,
}) => {
  const { graph } = useGraph()

  const [node, setNode] = useState<Node | undefined>(undefined)
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [iframeHeight, setIframeHeight] = useState(0)

  const handleIframeMessage = useCallback((event) => {
    if (event.data.type === 'setIframeHeight') {
      setIframeHeight(event.data.height)
    }
  }, [])
  useEffect(() => {
    window.addEventListener('message', handleIframeMessage)
    return () => {
      window.removeEventListener('message', handleIframeMessage)
    }
  }, [handleIframeMessage])

  const populateNode = useCallback(() => {
    if (graph.nodes.length > 0) {
      const _node = graph.nodes.find((node) => node.id === parentCustomNodeId)
      if (_node) {
        setNode(_node)
      } else {
        setNode(undefined)
      }
    }
  }, [graph, parentCustomNodeId])
  useEffect(() => {
    populateNode()
  }, [populateNode])

  const populateDetails = useCallback(() => {
    setHtml(node?.data?.source?.html || '')
    setCss(node?.data?.source?.css || '')
  }, [node])
  useEffect(() => {
    populateDetails()
  }, [populateDetails])

  if (!shouldRender) {
    return null
  } else {
    return (
      // render html and css securely within an iframe
      <iframe
        className={styles.renderer_container}
        style={expandHeight ? { height: `${iframeHeight}px` } : {}}
        srcDoc={`
          <html>
            <head>
              <style>
                ${
                  css
                    ? css
                    : // css with fallback to default styles if not provided
                      // TODO: import below
                      `
                      html,
                      body {
                        padding: 0;
                        margin: 0;
                        font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
                          Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                      }
                      a {
                        color: inherit;
                        text-decoration: none;
                      }
                      `
                }
              </style>
            </head>
            <body onload="window.parent.postMessage({ type: 'setIframeHeight', height: document.body.scrollHeight }, '*')">
              ${html}
            </body>
          </html>
        `}
      />
    )
  }
}

export default CustomNodeRenderer
