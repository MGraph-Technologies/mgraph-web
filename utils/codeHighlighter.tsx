import hljs from 'highlight.js/lib/core'
import plaintext from 'highlight.js/lib/languages/plaintext'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/docco.css'

hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)

// https://github.com/highlightjs/highlight.js/issues/925
export const highlight = (code: string, language: string) => {
  return (
    <code
      className="hljs"
      dangerouslySetInnerHTML={{
        __html: hljs.highlight(code, { language }).value,
      }}
    />
  )
}
