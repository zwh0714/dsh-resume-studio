/**
 * 三套版式 + 共用的排版标尺（单位：pt / mm）。
 * 设计目标：同一份数据结构，HTML 与 DOCX 用同一组“设计 token”渲染，保证观感一致。
 *
 * 页面尺寸默认 A4，可通过 meta.pageSize: "A4" | "Letter" 覆盖；
 * 字体默认走一条跨平台回退链，可通过 meta.font 覆盖正文字体；
 * 颜色/字号/行高/分区样式可通过 meta.theme 在预设上做微调。
 */
import { applyTheme } from './theme.js'

export const PAGE_SIZES = {
  A4: { label: 'A4', width: 210, height: 297 },
  Letter: { label: 'Letter', width: 215.9, height: 279.4 },
}

/** 跨平台中文回退链：Windows / macOS / Linux 各命中一个，最后兜 sans-serif */
export const FONT_FALLBACK = [
  'PingFang SC',
  'Hiragino Sans GB',
  'Noto Sans CJK SC',
  'Source Han Sans SC',
  'WenQuanYi Micro Hei',
]

export const TEMPLATES = {
  classic: {
    id: 'classic',
    name: '经典蓝线',
    desc: '深蓝分区线 + 单栏推进，稳重清晰，适合银行/国企/交付管理岗',
    page: { size: 'A4', width: 210, height: 297, top: 12, bottom: 12, left: 14, right: 14 },
    font: { body: 'Microsoft YaHei', latin: 'Segoe UI', fallback: FONT_FALLBACK },
    size: { body: 10.5, name: 22.5, intent: 11.25, section: 12.75, small: 9.5 },
    line: 14.8,
    color: { text: '1F2329', muted: '4E5969', accent: '1A5FB4', rule: 'B9C9DD', name: '111111', band: 'F4F7FB' },
    header: { layout: 'stack', infoColumns: 2, gap: 40, nameTracking: 1.5 },
    section: { style: 'rule', ruleSize: 9, spaceBefore: 8.25, spaceAfter: 3 },
    entry: { spaceBefore: 5.25, roleGap: '　' },
    bullet: { left: 14, hanging: 9, spaceBefore: 0 },
    rules: { pageNumbers: false },
  },

  minimal: {
    id: 'minimal',
    name: '极简黑白',
    desc: '无彩色、细横线、字距标题，克制专业，适合外企/学术/咨询',
    page: { size: 'A4', width: 210, height: 297, top: 14, bottom: 14, left: 16, right: 16 },
    font: { body: 'Microsoft YaHei', latin: 'Segoe UI', fallback: FONT_FALLBACK },
    size: { body: 10.5, name: 20, intent: 10.5, section: 10, small: 9.5 },
    line: 15.2,
    color: { text: '111111', muted: '555555', accent: '111111', rule: 'D0D0D0', name: '000000', band: 'FAFAFA' },
    header: { layout: 'stack', infoColumns: 3, gap: 24, nameTracking: 6 },
    section: { style: 'tracked', ruleSize: 4, spaceBefore: 10.5, spaceAfter: 3.75 },
    entry: { spaceBefore: 6, roleGap: ' · ' },
    bullet: { left: 13, hanging: 8, spaceBefore: 0 },
    rules: { pageNumbers: false },
  },

  sidebar: {
    id: 'sidebar',
    name: '侧栏信息带',
    desc: '首屏浅灰信息带（左姓名右联系）+ 左侧竖线分区，现代感强，适合互联网/产品/技术',
    page: { size: 'A4', width: 210, height: 297, top: 10, bottom: 12, left: 13, right: 13 },
    font: { body: 'Microsoft YaHei', latin: 'Segoe UI', fallback: FONT_FALLBACK },
    size: { body: 10.5, name: 20, intent: 10.5, section: 11.5, small: 9 },
    line: 14.6,
    color: { text: '1F2329', muted: '4E5969', accent: '0F766E', rule: 'CBD5D3', name: '0B1F1C', band: 'F1F5F4' },
    header: { layout: 'band', infoColumns: 3, gap: 14, nameTracking: 2 },
    section: { style: 'bar', ruleSize: 12, spaceBefore: 8, spaceAfter: 2.5 },
    entry: { spaceBefore: 5, roleGap: '　' },
    bullet: { left: 13.5, hanging: 8.5, spaceBefore: 0 },
    rules: { pageNumbers: true },
  },
}

export const TEMPLATE_IDS = Object.keys(TEMPLATES)

/** 页面尺寸名 → 尺寸；未知值回落 A4 */
export function pageSizeOf(name) {
  const key = String(name ?? '').trim()
  return PAGE_SIZES[key] || PAGE_SIZES.A4
}

/**
 * @param {string} id 版式 id
 * @param {object} [override] 来自 meta 的覆盖项：{ pageSize, font, theme }
 */
export function getTemplate(id, override = {}) {
  const base = TEMPLATES[id || 'classic']
  if (!base) throw new Error(`未知版式 "${id}"，可选：${TEMPLATE_IDS.join(' / ')}`)

  const size = override.pageSize ? pageSizeOf(override.pageSize) : null
  const font = override.font ? String(override.font).trim() : ''

  if (!size && !font && !override.theme) return base

  const merged = { ...base, page: { ...base.page }, font: { ...base.font } }
  if (size) {
    merged.page.size = size.label
    merged.page.width = size.width
    merged.page.height = size.height
  }
  if (font) merged.font.body = font

  // 主题在最后合并，优先级最高（它就是冲着「在预设上做微调」来的）
  return applyTheme(merged, override.theme)
}

export const PT_PER_MM = 72 / 25.4
export const TWIP_PER_PT = 20

export function pageWidthMm(t) {
  return t.page.width ?? PAGE_SIZES.A4.width
}

export function pageHeightMm(t) {
  return t.page.height ?? PAGE_SIZES.A4.height
}

export function textWidthPt(t) {
  return (pageWidthMm(t) - t.page.left - t.page.right) * PT_PER_MM
}

/** HTML 用的字体栈：正文字体 → 拉丁字体 → 跨平台回退 → sans-serif */
export function fontStack(t) {
  const list = [t.font.body, t.font.latin, ...(t.font.fallback || []), 'sans-serif']
  const seen = new Set()
  return list
    .filter((f) => f && !seen.has(f) && seen.add(f))
    .map((f) => (f === 'sans-serif' ? f : `"${f}"`))
    .join(', ')
}
