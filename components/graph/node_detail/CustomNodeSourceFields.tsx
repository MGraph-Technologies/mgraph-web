import { TabPanel, TabView } from 'primereact/tabview'
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import Editor from 'react-simple-code-editor'
import { Node } from 'reactflow'

import { useEditability } from '../../../contexts/editability'
import styles from '../../../styles/NodeDetail.module.css'
import { highlight } from '../../../utils/codeHighlighter'
import { CustomNodeProperties, CustomNodeSource } from '../CustomNode'

type CustomNodeSourceFieldsProps = {
  customNode: Node | undefined
  saveDetail: (
    name: keyof CustomNodeProperties,
    value: string | CustomNodeSource
  ) => void
}
const CustomNodeSourceFields: FunctionComponent<
  CustomNodeSourceFieldsProps
> = ({ customNode, saveDetail }) => {
  const { editingEnabled } = useEditability()

  const [sourceHtml, setSourceHtml] = useState('')
  const [sourceCss, setSourceCss] = useState('')
  const populateDetails = useCallback(() => {
    setSourceHtml(customNode?.data?.source?.html || '')
    setSourceCss(customNode?.data?.source?.css || '')
  }, [customNode])
  useEffect(() => {
    populateDetails()
  }, [populateDetails])

  return (
    <>
      <TabView>
        {/***** Source HTML Editor *****/}
        <TabPanel header="HTML">
          <pre className={styles.detail_field_code}>
            {editingEnabled ? (
              <Editor
                id="source-html-field"
                className={styles.editor}
                value={sourceHtml}
                onValueChange={(code) => setSourceHtml(code)}
                onBlur={() => {
                  saveDetail('source', {
                    ...customNode?.data?.source,
                    html: sourceHtml,
                  })
                }}
                highlight={(code) => highlight(code, 'html')}
                textareaClassName="react-simple-code-editor-textarea"
              />
            ) : (
              highlight(sourceHtml, 'html')
            )}
          </pre>
        </TabPanel>
        {/***** Source CSS Editor *****/}
        <TabPanel header="CSS">
          <pre className={styles.detail_field_code}>
            {editingEnabled ? (
              <Editor
                id="source-css-field"
                className={styles.editor}
                value={sourceCss}
                onValueChange={(code) => setSourceCss(code)}
                onBlur={() => {
                  saveDetail('source', {
                    ...customNode?.data?.source,
                    css: sourceCss,
                  })
                }}
                highlight={(code) => highlight(code, 'css')}
                textareaClassName="react-simple-code-editor-textarea"
              />
            ) : (
              highlight(sourceCss, 'css')
            )}
          </pre>
        </TabPanel>
      </TabView>
    </>
  )
}

export default CustomNodeSourceFields
