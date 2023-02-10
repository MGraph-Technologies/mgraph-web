import { Message } from 'primereact/message'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Node } from 'reactflow'

import { useQueries } from 'contexts/queries'
import { useGraph } from 'contexts/graph'
import styles from 'styles/CustomNodeRenderer.module.css'
import { parameterizeStatement } from 'utils/queryUtils'

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
  const { inputParameters } = useQueries()

  const [node, setNode] = useState<Node | undefined>(undefined)
  const [parameterizedHtml, setParameterizedHtml] = useState('')
  const [parameterizedCss, setParameterizedCss] = useState('')
  const [globalFontFamily, setGlobalFontFamily] = useState('')
  const [iframeHeight, setIframeHeight] = useState(0)

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

  const populateParameterizedHtml = useCallback(() => {
    setParameterizedHtml(
      parameterizeStatement(node?.data?.source?.html || '', inputParameters)
    )
  }, [node, inputParameters])
  useEffect(() => {
    populateParameterizedHtml()
  }, [populateParameterizedHtml])

  const populateParameterizedCss = useCallback(() => {
    setParameterizedCss(
      parameterizeStatement(node?.data?.source?.css || '', inputParameters)
    )
  }, [node, inputParameters])
  useEffect(() => {
    populateParameterizedCss()
  }, [populateParameterizedCss])

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

  if (!shouldRender) {
    return null
  } else {
    if (parameterizedHtml) {
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
                    ${parameterizedCss}
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
                ${parameterizedHtml}
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
