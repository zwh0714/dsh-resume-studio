/**
 * 简历数据模型：归一化、校验、富文本解析。
 *
 * 数据结构：
 * {
 *   "meta":    { "template": "classic", "maxPages": 3 },
 *   "basics":  { "name", "intent", "fields": [[label, value], ...] },
 *   "sections":[ {kind:"timeline"|"list"|"project", title, items|bullets} ]
 * }
 *
 * 正文用 **双星号** 标记加粗；HTML 与 DOCX 都解析同一套标记。
 */

import { normalizeLang } from './locale.js'
import { normalizeTheme } from './theme.js'

/**
 * 四种模块形态：
 *   timeline / project —— 带 head + date + bullets 的条目
 *   list               —— 只有 bullets
 *   paragraph          —— 整段文字（个人简介、自我评价这种，不该被渲染成 bullet）
 *
 * 不在这四种里的 kind 不再报错，改按内容形状推断（见 inferKind）。
 * 用户可以给模块起任意名字（「发表文章」「获奖」「开源项目」），
 * 只需要选对形状。
 */
export const SECTION_KINDS = ['timeline', 'list', 'project', 'paragraph']

/** 未知 kind 时按字段形状推断，而不是抛错 */
export function inferKind(section) {
  if (Array.isArray(section.items) && section.items.length) return 'timeline'
  if (typeof section.text === 'string' && section.text.trim()) return 'paragraph'
  if (Array.isArray(section.bullets) && section.bullets.length) return 'list'
  return 'list'
}

export function parseRich(text) {
  const out = []
  const src = String(text ?? '')
  let i = 0
  while (i < src.length) {
    const open = src.indexOf('**', i)
    if (open === -1) {
      if (i < src.length) out.push({ text: src.slice(i), bold: false })
      break
    }
    if (open > i) out.push({ text: src.slice(i, open), bold: false })
    const close = src.indexOf('**', open + 2)
    if (close === -1) {
      out.push({ text: src.slice(open), bold: false })
      break
    }
    out.push({ text: src.slice(open + 2, close), bold: true })
    i = close + 2
  }
  return out.filter((r) => r.text.length > 0)
}

export function normalize(data) {
  if (!data || typeof data !== 'object') throw new Error('简历数据必须是一个 JSON 对象')
  const basics = data.basics || {}
  if (!basics.name) throw new Error('缺少 basics.name（姓名）')

  const fields = Array.isArray(basics.fields)
    ? basics.fields
        .filter((f) => Array.isArray(f) && f.length >= 2 && f[0] && f[1] != null && String(f[1]).trim())
        .map((f) => [String(f[0]), String(f[1])])
    : []

  const sections = (data.sections || []).map((s, idx) => {
    const declared = s.kind ? String(s.kind) : 'list'
    const kind = SECTION_KINDS.includes(declared) ? declared : inferKind(s)
    if (!s.title) throw new Error(`sections[${idx}] 缺少 title`)

    const sec = { kind, title: String(s.title) }
    // 记下原始 kind，供 lint 提示「已按 xxx 渲染」。
    // 数据可能被 normalize 两次（loadData → checkResume），这里要能继承上次的结论，
    // 否则第二次会看到已归一化的 kind，把提示丢掉。
    if (declared !== kind) sec.declaredKind = declared
    else if (s.declaredKind) sec.declaredKind = String(s.declaredKind)

    if (kind === 'paragraph') {
      const text = String(s.text ?? (Array.isArray(s.bullets) ? s.bullets.join('\n\n') : '')).trim()
      if (!text) throw new Error(`sections[${idx}]「${sec.title}」是 paragraph，但没有 text`)
      sec.text = text
    } else if (kind === 'list') {
      sec.bullets = (s.bullets || []).map(String)
    } else {
      sec.items = (s.items || []).map((it) => ({
        head: String(it.head || ''),
        sub: it.sub ? String(it.sub) : '',
        date: it.date ? String(it.date) : '',
        intro: it.intro ? String(it.intro) : '',
        label: it.label ? String(it.label) : '',
        bullets: (it.bullets || []).map(String),
      }))
    }
    return sec
  })

  if (!sections.length) throw new Error('sections 不能为空')

  return {
    meta: {
      template: data.meta?.template || 'classic',
      maxPages: Number(data.meta?.maxPages) || 0,
      lang: normalizeLang(data.meta?.lang),
      pageSize: data.meta?.pageSize ? String(data.meta.pageSize) : '',
      font: data.meta?.font ? String(data.meta.font) : '',
      theme: normalizeTheme(data.meta?.theme),
      allowQualitative: Boolean(data.meta?.allowQualitative),
    },
    basics: {
      name: String(basics.name),
      intent: basics.intent ? String(basics.intent) : '',
      fields,
    },
    sections,
  }
}

/** 统计用：所有可见文字 */
export function plainText(data) {
  const parts = [data.basics.name, data.basics.intent, ...data.basics.fields.flat()]
  for (const s of data.sections) {
    parts.push(s.title)
    if (s.kind === 'paragraph') parts.push(s.text)
    else if (s.kind === 'list') parts.push(...s.bullets)
    else for (const it of s.items) parts.push(it.head, it.sub, it.date, it.intro, it.label, ...it.bullets)
  }
  return parts.filter(Boolean).join('\n')
}
