/**
 * 主题 token：把「三套版式」从写死的成品，变成可调的起点。
 *
 * 用户诉求是「用 classic，但主色换深绿、正文大一号」这类微调，
 * 而不是再要第四套版式。所以这里只开放能安全映射到 DOCX 与 HTML
 * 同一套 token 的维度：颜色、正文字体、字号比例、行高、分区标题样式。
 *
 * 刻意不开放：页边距、分栏、绝对定位。前者已有 pageSize，后两者
 * 在 DOCX 里无法与 HTML 保持同源，会直接破坏「Word 与 PDF 同源」这个前提。
 */

const COLOR_KEYS = ['accent', 'text', 'muted', 'band', 'rule', 'name']
const SECTION_STYLES = ['rule', 'tracked', 'bar']

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** `#abc` / `abc` / `#aabbcc` / `aabbcc` → `AABBCC`；非法值返回 null */
export function hexColor(value) {
  if (typeof value !== 'string') return null
  const raw = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
  return null
}

/**
 * 清洗用户给的主题，非法项直接丢掉而不是抛错
 * （用户写错颜色不该让整份简历渲染失败）。
 * @returns {object|null} 没有任何有效项时返回 null
 */
export function normalizeTheme(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}

  for (const key of COLOR_KEYS) {
    const v = hexColor(raw[key])
    if (v) out[key] = v
  }

  if (typeof raw.font === 'string' && raw.font.trim()) out.font = raw.font.trim().slice(0, 60)

  const bodySize = Number(raw.bodySize)
  if (Number.isFinite(bodySize) && bodySize > 0) out.bodySize = +clamp(bodySize, 8, 16).toFixed(2)

  const lineHeight = Number(raw.lineHeight)
  if (Number.isFinite(lineHeight) && lineHeight > 0) out.lineHeight = +clamp(lineHeight, 0.85, 1.6).toFixed(3)

  if (SECTION_STYLES.includes(raw.sectionStyle)) out.sectionStyle = raw.sectionStyle

  return Object.keys(out).length ? out : null
}

/**
 * 把主题合进模板。返回新对象，不修改模板常量。
 *
 * 入参先过一遍 normalizeTheme：调用方可能直接给 `#RRGGBB` 或原始 UI 值，
 * 而模板里存的是不带 `#` 的十六进制，混着用会渲染出 `##RRGGBB`。
 *
 * 字号缩放会带着行高一起等比放大，否则「大一号」会立刻把页数顶爆。
 */
export function applyTheme(t, theme) {
  const clean = normalizeTheme(theme)
  if (!clean) return t

  const merged = { ...t, color: { ...t.color }, size: { ...t.size }, section: { ...t.section }, font: { ...t.font } }

  for (const key of COLOR_KEYS) {
    if (clean[key]) merged.color[key] = clean[key]
  }

  if (clean.font) merged.font.body = clean.font

  if (clean.bodySize) {
    const ratio = clean.bodySize / t.size.body
    for (const key of Object.keys(t.size)) {
      merged.size[key] = +(t.size[key] * ratio).toFixed(2)
    }
    merged.line = +(t.line * ratio).toFixed(2)
  }

  if (clean.lineHeight) merged.line = +(merged.line * clean.lineHeight).toFixed(2)

  if (clean.sectionStyle) merged.section.style = clean.sectionStyle

  return merged
}
