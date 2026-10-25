import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SafeMarkdown from './SafeMarkdown'

const evilUrls = (container) =>
  Array.from(container.querySelectorAll('[href], [src]')).filter((el) =>
    /^(javascript|data:text\/html|vbscript|file):/i.test(
      el.getAttribute('href') || el.getAttribute('src') || ''
    )
  )

describe('SafeMarkdown', () => {
  it('renders benign markdown identically: headings, bold, lists, links, code', () => {
    const { container } = render(
      <SafeMarkdown>
        {'# Hello\n\nSome **bold** text and `inline code`.\n\n- item one\n- item two\n\n[docs](https://example.com/guide)\n\n```js\nconst x = 1\n```\n'}
      </SafeMarkdown>
    )

    expect(container.querySelector('h1')?.textContent).toBe('Hello')
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('code')?.textContent).toContain('inline code')

    const link = container.querySelector('a')
    expect(link?.textContent).toBe('docs')
    expect(link?.getAttribute('href')).toBe('https://example.com/guide')

    expect(container.querySelector('pre code')?.textContent).toContain('const x = 1')
  })

  it('keeps page-level component overrides working (styling passthrough)', () => {
    const { container } = render(
      <SafeMarkdown components={{ a: ({ href, children }) => <a href={href} className="custom-link">{children}</a> }}>
        {'[styled](https://example.com)'}
      </SafeMarkdown>
    )
    const link = container.querySelector('a.custom-link')
    expect(link?.textContent).toBe('styled')
    expect(link?.getAttribute('href')).toBe('https://example.com')
  })

  it('neutralizes javascript: link targets', () => {
    const { container } = render(
      <SafeMarkdown>{'[click me](javascript:alert(1))'}</SafeMarkdown>
    )
    expect(evilUrls(container)).toHaveLength(0)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href') || '').not.toContain('javascript:')
  })

  it('neutralizes data:/vbscript: link targets and protocol-relative URLs', () => {
    const { container } = render(
      <SafeMarkdown>
        {'[a](data:text/html,<script>alert(1)</script>)\n\n[b](vbscript:msgbox(1))\n\n[c](//evil.example/x)'}
      </SafeMarkdown>
    )
    expect(evilUrls(container)).toHaveLength(0)
    container.querySelectorAll('a').forEach((a) => {
      expect(a.getAttribute('href') || '').not.toMatch(/^(data|vbscript):/i)
      expect(a.getAttribute('href') || '').not.toMatch(/^\/\//)
    })
  })

  it('strips script, iframe, object, embed and style elements from raw HTML', () => {
    const { container } = render(
      <SafeMarkdown>
        {'<script>alert("xss")</script>\n\n<iframe src="https://evil.example"></iframe>\n\n<style>body{display:none}</style>'}
      </SafeMarkdown>
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('object')).toBeNull()
    expect(container.querySelector('embed')).toBeNull()
    expect(container.querySelector('style')).toBeNull()
  })

  it('strips event-handler attributes from raw HTML tags', () => {
    const { container } = render(
      <SafeMarkdown>{'<img src="https://example.com/x.png" onerror="alert(1)">\n\n<svg onload="alert(1)"></svg>'}</SafeMarkdown>
    )
    expect(container.querySelector('[onerror]')).toBeNull()
    expect(container.querySelector('[onload]')).toBeNull()
    expect(evilUrls(container)).toHaveLength(0)
  })

  it('allows relative links and mailto: links', () => {
    const { container } = render(
      <SafeMarkdown>{'[local](/docs/guide)\n\n[mail](mailto:team@example.com)'}</SafeMarkdown>
    )
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/docs/guide')
    expect(hrefs).toContain('mailto:team@example.com')
  })
})
