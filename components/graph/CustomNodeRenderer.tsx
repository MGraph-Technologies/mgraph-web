import { Message } from 'primereact/message'
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
  const [globalFontFamily, setGlobalFontFamily] = useState('')
  const [iframeHeight, setIframeHeight] = useState(0)

  const populateGlobalFontFamily = useCallback(() => {
    // inject page font family into iframe by default
    const _globalFontFamily = window
      .getComputedStyle(document.body)
      .getPropertyValue('font-family')
    setGlobalFontFamily(_globalFontFamily)
  }, [])
  useEffect(() => {
    populateGlobalFontFamily()
  }, [populateGlobalFontFamily])

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
    if (html) {
      return (
        // render html and css securely within an iframe
        <iframe
          className={styles.renderer_container}
          style={expandHeight ? { height: `${iframeHeight}px` } : {}}
          srcDoc={`
            <html>
              <head>
                <style>
                  ${`
                    ${css}
                    html,
                    body {
                      padding: 0;
                      margin: 0;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      ${
                        globalFontFamily
                          ? `font-family: ${globalFontFamily};`
                          : ''
                      }
                    }
                    a {
                      color: inherit;
                      text-decoration: none;
                    }
                    `}
                </style>
              </head>
              <body onload="window.parent.postMessage({ type: 'setIframeHeight', height: document.body.scrollHeight }, '*')">
                ${html}
              </body>
            </html>
          `}
        />
      )
    } else {
      return (
        <div className={styles.renderer_container}>
          <Message
            className={styles.renderer_message}
            severity="info"
            text="Define source to render content"
          />
        </div>
      )
    }
  }
}

export default CustomNodeRenderer
