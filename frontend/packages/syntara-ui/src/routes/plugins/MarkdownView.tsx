import { Content } from '@patternfly/react-core'
import { useMemo } from 'react'

type MarkdownViewProps = {
  /** Markdown source (headers, lists, code, links, emphasis). */
  source: string | null | undefined
}

type ListType = 'ul' | 'ol'

/** Mutable renderer state threaded through the line handlers below. */
type RenderState = {
  output: string[]
  inCodeBlock: boolean
  listType: ListType | null
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function renderInline(text: string): string {
  // Links are applied before the code-span split so link text that itself
  // contains code spans (e.g. "[`file`](url)") still resolves into one anchor.
  const linked = escapeHtml(text).replaceAll(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  )
  // Code spans next so their content is not further formatted.
  return linked
    .split(/(`[^`]+`)/g)
    .map((segment) => {
      if (segment.startsWith('`') && segment.endsWith('`') && segment.length > 2) {
        return `<code>${escapeHtml(segment.slice(1, -1))}</code>`
      }
      let html = segment
      html = html.replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      html = html.replaceAll(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      return html
    })
    .join('')
}

function closeList(state: RenderState): void {
  if (state.listType) {
    state.output.push(`</${state.listType}>`)
    state.listType = null
  }
}

/** Handle one fence-delimited code block boundary or content line. Returns true when handled. */
function handleCodeLine(line: string, state: RenderState): boolean {
  if (!line.startsWith('```')) return false
  closeList(state)
  state.output.push(state.inCodeBlock ? '</code></pre>' : '<pre><code>')
  state.inCodeBlock = !state.inCodeBlock
  return true
}

/** Handle one list item line (unordered or ordered). Returns true when handled. */
function handleListItem(line: string, state: RenderState): boolean {
  const unordered = line.match(/^\s*[-*]\s+(.*)$/)
  const ordered = unordered ? null : line.match(/^\s*\d+\.\s+(.*)$/)
  const match = unordered ?? ordered
  if (!match) return false

  const wanted: ListType = unordered ? 'ul' : 'ol'
  if (state.listType !== wanted) {
    closeList(state)
    state.output.push(`<${wanted}>`)
    state.listType = wanted
  }
  state.output.push(`<li>${renderInline(match[1])}</li>`)
  return true
}

/** Handle one heading or paragraph line (closing any open list first). */
function handleBlockLine(line: string, state: RenderState): void {
  closeList(state)
  if (line.trim() === '') {
    state.output.push('')
    return
  }
  const heading = line.match(/^(#{1,4})\s+(.*)$/)
  if (heading) {
    const level = heading[1].length
    state.output.push(`<h${level + 1}>${renderInline(heading[2])}</h${level + 1}>`)
    return
  }
  state.output.push(`<p>${renderInline(line)}</p>`)
}

/** True for lines that start a new block (heading, list item, or fence). */
function isBlockStart(line: string): boolean {
  return /^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(line)
}

/**
 * Join soft-wrapped source lines so inline spans broken across a line break
 * (e.g. ``**Say\nhello**``) render as one paragraph, and indented continuation
 * lines extend their list item.
 */
function normalizeLines(lines: string[]): string[] {
  const output: string[] = []
  let inCode = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCode = !inCode
      output.push(line)
      continue
    }
    if (inCode) {
      output.push(line)
      continue
    }
    const previous = output[output.length - 1]
    const canContinue =
      previous !== undefined &&
      previous.trim() !== '' &&
      !isBlockStart(line) &&
      line.trim() !== '' &&
      !/^(#{1,4}\s|```)/.test(previous) &&
      !previous.startsWith('```')
    if (canContinue) {
      output[output.length - 1] = `${previous} ${line.trim()}`
    } else {
      output.push(line)
    }
  }
  return output
}

function renderMarkdown(source: string): string {
  const state: RenderState = { output: [], inCodeBlock: false, listType: null }
  for (const line of normalizeLines(source.split(/\r?\n/))) {
    if (handleCodeLine(line, state)) continue
    if (state.inCodeBlock) {
      state.output.push(`${escapeHtml(line)}\n`)
      continue
    }
    if (handleListItem(line, state)) continue
    handleBlockLine(line, state)
  }
  closeList(state)
  if (state.inCodeBlock) state.output.push('</code></pre>')
  return state.output.join('\n')
}

/**
 * Minimal, dependency-free Markdown renderer for plugin documentation.
 *
 * Supports the subset authored by the Syntara Plugin SDK docs template:
 * headers, unordered/ordered lists, fenced code blocks, paragraphs, and
 * inline emphasis/links. Everything is escaped before tags are added.
 */
export function MarkdownView({ source }: Readonly<MarkdownViewProps>) {
  const html = useMemo(() => (source ? renderMarkdown(source) : ''), [source])

  if (!source) {
    return <Content component="p">No documentation available.</Content>
  }

  // Content is escaped in renderInline/escapeHtml before any tags are added.
  return <div className="syn-markdown-view" dangerouslySetInnerHTML={{ __html: html }} />
}
