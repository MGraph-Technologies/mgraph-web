import { Message } from 'primereact/message'
import { ProgressSpinner } from 'primereact/progressspinner'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Node } from 'reactflow'

import { useGraph } from 'contexts/graph'
import { useQueries } from 'contexts/queries'
import styles from 'styles/CustomNodeRenderer.module.css'
import { parameterizeStatement } from 'utils/queryUtils'

const deploymentUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'http://localhost:3000'

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
  const { globalSourceRefreshes, inputParameters } = useQueries()

  const [node, setNode] = useState<Node | undefined>(undefined)
  const [parameterizedHtml, setParameterizedHtml] = useState('')
  const [parameterizedCss, setParameterizedCss] = useState('')
  const [globalFontFamily, setGlobalFontFamily] = useState('')
  const [rendererUrl, setRendererUrl] = useState('')
  const [iframeHeight, setIframeHeight] = useState(0)
  const [iframeLoading, setIframeLoading] = useState(true)

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

  // we proxy html through api/v1/render to sandbox it
  const populateRendererUrl = useCallback(
    (refreshNum = 0) => {
      setIframeHeight(0)
      setIframeLoading(true)

      if (!parameterizedHtml) {
        setRendererUrl('')
        setIframeLoading(false)
        return
      }

      // form srcDoc
      const srcDoc = `
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
                  ${globalFontFamily ? `font-family: ${globalFontFamily};` : ''}
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
      `

      // encode srcDoc
      const encodedSrcDoc = encodeURIComponent(srcDoc)

      // form render url, using deployment url for sandboxing
      const apiPath = `/api/v1/html-renderer?srcDoc=${encodedSrcDoc}`
      const _rendererUrl = `${deploymentUrl}${apiPath}${
        refreshNum > 0 ? `&refreshNum=${refreshNum}` : ''
      }`
      setRendererUrl(_rendererUrl)
    },
    [parameterizedHtml, parameterizedCss, globalFontFamily]
  )
  useEffect(() => {
    populateRendererUrl(globalSourceRefreshes)
  }, [populateRendererUrl, globalSourceRefreshes])

  const handleIframeMessage = useCallback((event) => {
    if (event.data.type === 'setIframeHeight') {
      setIframeHeight(event.data.height)
      setIframeLoading(false)
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
    return (
      <>
        {/* overlay progress spinner til iframe done loading */}
        {iframeLoading && (
          <div className={styles.progress_spinner_overlay}>
            <ProgressSpinner
              className={styles.progress_spinner}
              strokeWidth="4"
            />
          </div>
        )}
        {rendererUrl ? (
          <iframe
            className={styles.renderer_container}
            style={expandHeight ? { height: `${iframeHeight}px` } : {}}
            src={rendererUrl}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : (
          <div className={styles.renderer_container}>
            <Message
              className={styles.renderer_message}
              severity="info"
              text="Define source to render content"
            />
          </div>
        )}
      </>
    )
  }
}

export default CustomNodeRenderer
