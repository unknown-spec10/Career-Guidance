import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { defaultSchema } from 'hast-util-sanitize'
import { safeUrlTransform } from '../utils/sanitize'

// H6: every LLM/markdown render path must go through this wrapper — never use
// bare `react-markdown` directly. Defense in depth:
//   1. `rehype-raw` is deliberately NOT enabled, so raw HTML in markdown
//      source is escaped to text instead of becoming live DOM nodes.
//   2. `rehype-sanitize` strips script/iframe/object/embed/style tags and all
//      event-handler attributes from anything that does reach the tree.
//   3. `safeUrlTransform` allowlists link/image targets (http/https/mailto +
//      relative URLs), so `javascript:` / `data:` / `vbscript:` targets can
//      never reach a rendered `href`/`src` — regardless of what a page-level
//      `components.a` override does with the value.
const sanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },
}

export default function SafeMarkdown({ components, children, ...rest }) {
  return (
    <ReactMarkdown
      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
      urlTransform={safeUrlTransform}
      components={components}
      {...rest}
    >
      {children}
    </ReactMarkdown>
  )
}
