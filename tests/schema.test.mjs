/**
 * L1（开放 kind）与 L2（主题 token）的契约测试。
 *
 * 这两个能力的共同目标：让「用户想加自己的东西」不再需要模型临时发明结构，
 * 也不再需要绕过插件手写 HTML/DOCX。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { inferKind, normalize } from '../lib/model.js'
import { lint } from '../lib/lint.js'
import { renderHTML } from '../lib/render-html.js'
import { buildDocx } from '../lib/render-docx.js'
import { getTemplate } from '../lib/templates.js'
import { applyTheme, hexColor, normalizeTheme } from '../lib/theme.js'

const base = (sections, meta = {}) => ({
  meta: { template: 'classic', maxPages: 2, ...meta },
  basics: {
    name: '结构测试',
    intent: '求职意向：后端工程师',
    fields: [
      ['电话', '13800000000'],
      ['邮箱', 'a@b.com'],
    ],
  },
  sections,
})

const para = (text = '十年后端经验，近三年带 **6 人小组**。', title = '个人简介') => ({
  kind: 'paragraph',
  title,
  text,
})

// ---------------------------------------------------------------- L1 ----

test('paragraph 渲染成段落而不是 bullet', () => {
  const d = normalize(base([para()]))
  const html = renderHTML(d, getTemplate('classic'))
  assert.match(html, /<p class="prose">/)
  assert.match(html, /<strong>6 人小组<\/strong>/)
  assert.doesNotMatch(html, /<li>.*6 人小组/)
})

test('paragraph 用空行拆成多段', () => {
  const d = normalize(base([para('第一段。\n\n第二段。')]))
  const html = renderHTML(d, getTemplate('classic'))
  assert.equal((html.match(/<p class="prose">/g) || []).length, 2)
})

test('paragraph 没给 text 时抛错并指出是哪个模块', () => {
  assert.throws(
    () => normalize(base([{ kind: 'paragraph', title: '个人简介' }])),
    /「个人简介」是 paragraph/,
  )
})

test('paragraph 只给 bullets 时按段落拼接', () => {
  const d = normalize(base([{ kind: 'paragraph', title: '简介', bullets: ['甲。', '乙。'] }]))
  assert.equal(d.sections[0].kind, 'paragraph')
  assert.match(d.sections[0].text, /甲。\n\n乙。/)
})

test('未知 kind 按形状推断：有 items → timeline', () => {
  const s = { kind: 'opensource', title: '开源项目', items: [{ head: 'x', bullets: ['y'] }] }
  assert.equal(inferKind(s), 'timeline')
  const d = normalize(base([s]))
  assert.equal(d.sections[0].kind, 'timeline')
  assert.equal(d.sections[0].declaredKind, 'opensource')
})

test('未知 kind 按形状推断：只有 bullets → list', () => {
  const d = normalize(base([{ kind: 'awards', title: '获奖', bullets: ['年度技术贡献奖'] }]))
  assert.equal(d.sections[0].kind, 'list')
  assert.equal(d.sections[0].declaredKind, 'awards')
})

test('未知 kind 按形状推断：只有 text → paragraph', () => {
  const d = normalize(base([{ kind: 'summary', title: '简介', text: '一段话。' }]))
  assert.equal(d.sections[0].kind, 'paragraph')
})

test('未知 kind 会在体检里说明被当成了什么', () => {
  const d = normalize(base([{ kind: 'awards', title: '获奖', bullets: ['奖'] }]))
  const issues = lint(d, {}).issues.filter((i) => i.rule === 'kind')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].level, 'info')
  assert.match(issues[0].message, /awards/)
  assert.match(issues[0].message, /列表/)
})

test('normalize 是幂等的，declaredKind 不会在第二次归一化时丢失', () => {
  const once = normalize(base([{ kind: 'awards', title: '获奖', bullets: ['奖'] }]))
  const twice = normalize(once)
  assert.deepEqual(twice, once)
  assert.equal(twice.sections[0].declaredKind, 'awards')
})

test('DOCX 也支持 paragraph', async () => {
  const d = normalize(base([para()]))
  const buf = await buildDocx(d, getTemplate('classic'))
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
})

test('paragraph 的字数进入加粗占比分母', () => {
  // 一句话里几乎全加粗：占比应被算出来并触发告警
  const d = normalize(base([para('**整段都加粗的一段话**')]))
  const bold = lint(d, {}).issues.filter((i) => i.rule === 'bold')
  assert.equal(bold.length, 1)
})

test('paragraph 过长会触发 density', () => {
  const d = normalize(base([para('很长的简介。'.repeat(50))]))
  const density = lint(d, {}).issues.filter((i) => i.rule === 'density')
  assert.equal(density.length, 1)
  assert.ok(density[0].message.includes('简介'))
})

// ---------------------------------------------------------------- L2 ----

test('hexColor 接受三种写法的同一种颜色', () => {
  assert.equal(hexColor('#0f766e'), '0F766E')
  assert.equal(hexColor('0F766E'), '0F766E')
  assert.equal(hexColor('#abc'), 'AABBCC')
  assert.equal(hexColor('zzz'), null)
  assert.equal(hexColor(123), null)
})

test('normalizeTheme 丢掉非法项而不是抛错', () => {
  const t = normalizeTheme({ accent: 'nope', text: '#111', bodySize: 999, lineHeight: 99, sectionStyle: 'nope' })
  assert.deepEqual(t, { text: '111111', bodySize: 16, lineHeight: 1.6 })
  assert.equal(normalizeTheme({}), null)
  assert.equal(normalizeTheme(null), null)
  assert.equal(normalizeTheme([]), null)
})

test('normalizeTheme 保留合法字体与分区样式', () => {
  const t = normalizeTheme({ font: 'Noto Serif SC', sectionStyle: 'bar' })
  assert.deepEqual(t, { font: 'Noto Serif SC', sectionStyle: 'bar' })
})

test('applyTheme 换主色且不修改模板常量', () => {
  const tpl = getTemplate('classic')
  const themed = applyTheme(tpl, { accent: '0F766E' })
  assert.equal(themed.color.accent, '0F766E')
  assert.equal(tpl.color.accent, '1A5FB4')
})

test('applyTheme 放大字号时行高同比放大，避免直接顶爆页数', () => {
  const tpl = getTemplate('classic')
  const themed = applyTheme(tpl, { bodySize: 12.6 }) // 1.2 倍
  assert.equal(themed.size.body, 12.6)
  assert.equal(themed.line, +(tpl.line * 1.2).toFixed(2))
  assert.ok(themed.size.name > tpl.size.name)
})

test('applyTheme 的 lineHeight 是行距倍数', () => {
  const tpl = getTemplate('classic')
  const themed = applyTheme(tpl, { lineHeight: 1.1 })
  assert.equal(themed.line, +(tpl.line * 1.1).toFixed(2))
})

test('getTemplate 把主题合进颜色与分区样式', () => {
  const t = getTemplate('minimal', { theme: { accent: '#8C2F39', sectionStyle: 'bar' } })
  assert.equal(t.color.accent, '8C2F39')
  assert.equal(t.section.style, 'bar')
  // 未指定的项沿用预设
  assert.equal(t.color.text, getTemplate('minimal').color.text)
})

test('主题里的颜色与字号真的进了 HTML', () => {
  const d = normalize(base([para()], { theme: { accent: '#0F766E', bodySize: 11 } }))
  const html = renderHTML(d, getTemplate('classic', { theme: d.meta.theme }))
  assert.match(html, /--accent: #0F766E;/)
  assert.match(html, /--body: 11pt;/)
})

test('主题里的分区样式真的进了 HTML 的 class', () => {
  const d = normalize(base([para()], { theme: { sectionStyle: 'bar' } }))
  const html = renderHTML(d, getTemplate('classic', { theme: d.meta.theme }))
  assert.match(html, /sec-title bar/)
})

test('主题也会改变 DOCX 的字节（颜色写进了 XML）', async () => {
  const d = normalize(base([para()]))
  const plain = await buildDocx(d, getTemplate('classic'))
  const themed = await buildDocx(d, getTemplate('classic', { theme: normalizeTheme({ accent: '#8C2F39' }) }))
  assert.ok(!plain.equals(themed), '主色不同，DOCX 字节应不同')
})

test('非法主题不会让渲染失败，只是被忽略', () => {
  const d = normalize(base([para()], { theme: { accent: 'not-a-color', bodySize: 'big' } }))
  assert.equal(d.meta.theme, null)
  const html = renderHTML(d, getTemplate('classic', { theme: d.meta.theme }))
  assert.match(html, /--accent: #1A5FB4;/, '应回落预设主色')
})
