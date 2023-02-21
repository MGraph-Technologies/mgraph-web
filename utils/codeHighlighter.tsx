import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import plaintext from 'highlight.js/lib/languages/plaintext'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/googlecode.css' // purply

hljs.registerLanguage('css', css)
hljs.registerLanguage('html', html)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)

type SupportedLanguage = 'css' | 'html' | 'plaintext' | 'sql' | 'yaml'

// https://github.com/highlightjs/highlight.js/issues/925
export const highlight = (code: string, language: SupportedLanguage) => {
  return (
    <code
      className="hljs"
      dangerouslySetInnerHTML={{
        __html: hljs.highlight(code, { language }).value,
      }}
    />
  )
}
