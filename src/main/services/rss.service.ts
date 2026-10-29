import { XMLParser } from 'fast-xml-parser'

// Đọc RSS 2.0 / Atom thành danh sách bài viết đơn giản

export interface FeedItem {
  title: string
  url: string
  date: number // ms, 0 nếu không rõ
  summary: string
  image: string | null
  source: string | null // Tên báo (Google News: thẻ <source>, Bing News: <News:Source>)
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  // Luôn trả mảng cho các thẻ có thể lặp lại
  isArray: (name) => ['item', 'entry', 'link', 'media:content', 'media:thumbnail'].includes(name),
  processEntities: true,
  htmlEntities: true
})

const MAX_SUMMARY = 180

type Node = string | number | { [key: string]: unknown } | undefined

// Lấy nội dung chữ của một thẻ (có thể là chuỗi, CDATA hoặc object có #text)
function text(node: Node): string {
  if (node === undefined || node === null) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  const value = (node as Record<string, unknown>)['#text']
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function attr(node: unknown, name: string): string | null {
  if (!node || typeof node !== 'object') return null
  const value = (node as Record<string, unknown>)[`@_${name}`]
  return typeof value === 'string' ? value : null
}

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    // Bing ghi tiếng Việt dạng chữ + dấu rời => gộp lại cho chữ hiển thị chuẩn
    .normalize('NFC')

// HTML/BBCode => đoạn văn ngắn
export function toSummary(html: string, maxLength = MAX_SUMMARY): string {
  const plain = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[\/?[a-z*][^\]]*\]/gi, ' ')
  )
    .replace(/\\\[/g, '[')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > maxLength ? `${plain.slice(0, maxLength - 3).trimEnd()}...` : plain
}

function firstImageInHtml(html: string): string | null {
  const src = html.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]
  return src ? decodeEntities(src) : null
}

const httpsOnly = (url: string | null): string | null =>
  url && /^https:\/\//i.test(url.trim()) ? url.trim() : null

// Link Bing News là link đếm lượt bấm (http) chứa link bài gốc ở tham số url
function unwrapBingLink(url: string): string {
  try {
    const parsed = new URL(url.trim())
    if (/(^|\.)bing\.com$/i.test(parsed.hostname) && parsed.pathname === '/news/apiclick.aspx') {
      return parsed.searchParams.get('url') ?? url
    }
  } catch {
    // Không phải URL hợp lệ, để httpsOnly loại
  }
  return url
}

// Ảnh thumbnail của Bing News ghi http, nhưng máy chủ hỗ trợ https
function bingImage(item: Record<string, unknown>): string | null {
  const url = text(item['News:Image'] as Node).trim()
  return /^http:\/\/www\.bing\.com\/th\?/i.test(url) ? url.replace(/^http:/i, 'https:') : null
}

function parseDate(value: string): number {
  const time = Date.parse(value)
  return Number.isNaN(time) ? 0 : time
}

// Ảnh từ các thẻ media chuẩn, không có thì lấy ảnh đầu tiên trong nội dung
function itemImage(item: Record<string, unknown>, html: string): string | null {
  const media = [
    ...((item['media:content'] as unknown[]) ?? []),
    ...((item['media:thumbnail'] as unknown[]) ?? [])
  ]
  for (const m of media) {
    const url = httpsOnly(attr(m, 'url'))
    const medium = attr(m, 'medium') ?? attr(m, 'type') ?? 'image'
    if (url && /image/i.test(medium)) return url
  }
  const enclosure = item.enclosure
  if (enclosure && /image/i.test(attr(enclosure, 'type') ?? 'image')) {
    const url = httpsOnly(attr(enclosure, 'url'))
    if (url) return url
  }
  return httpsOnly(firstImageInHtml(html))
}

function parseRssItem(item: Record<string, unknown>): FeedItem | null {
  const links = (item.link as Node[]) ?? []
  const url = httpsOnly(unwrapBingLink(text(links[0]) || text(item.guid as Node)))
  const title = decodeEntities(text(item.title as Node)).trim()
  if (!url || !title) return null

  const html = text(item['content:encoded'] as Node) || text(item.description as Node)
  const source = text(item.source as Node) || text(item['News:Source'] as Node)
  return {
    title,
    url,
    date: parseDate(text(item.pubDate as Node) || text(item['dc:date'] as Node)),
    summary: toSummary(html),
    image: itemImage(item, html) ?? bingImage(item),
    source: decodeEntities(source).trim() || null
  }
}

function parseAtomEntry(entry: Record<string, unknown>): FeedItem | null {
  const links = (entry.link as unknown[]) ?? []
  const alternate = links.find((l) => (attr(l, 'rel') ?? 'alternate') === 'alternate') ?? links[0]
  const url = httpsOnly(attr(alternate, 'href'))
  const title = decodeEntities(text(entry.title as Node)).trim()
  if (!url || !title) return null

  const html = text(entry.content as Node) || text(entry.summary as Node)
  return {
    title,
    url,
    date: parseDate(text(entry.published as Node) || text(entry.updated as Node)),
    summary: toSummary(html),
    image: itemImage(entry, html),
    source: null
  }
}

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml) as Record<string, Record<string, unknown>>
  const channel = doc.rss?.channel as Record<string, unknown> | undefined
  const raw: [Record<string, unknown>[], typeof parseRssItem] = channel
    ? [(channel.item as Record<string, unknown>[]) ?? [], parseRssItem]
    : [(doc.feed?.entry as Record<string, unknown>[]) ?? [], parseAtomEntry]

  const [items, parse] = raw
  return items.map((i) => parse(i)).filter((i): i is FeedItem => i !== null)
}
