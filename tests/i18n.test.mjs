import assert from 'node:assert/strict'
import test from 'node:test'

import { normalize } from '../lib/model.js'
import { lint } from '../lib/lint.js'
import { renderHTML } from '../lib/render-html.js'
import { buildDocx } from '../lib/render-docx.js'
import { PAGE_SIZES, fontStack, getTemplate, pageHeightMm, pageWidthMm } from '../lib/templates.js'
import { LOCALE, normalizeLang, resumeFileName } from '../lib/locale.js'
import { buildSkeleton } from '../lib/skeleton.js'
import { describeSource } from '../lib/import.js'

const enResume = {
  meta: { template: 'classic', maxPages: 2, lang: 'en' },
  basics: {
    name: 'Alex Chen',
    intent: 'Target role: Backend Engineer',
    fields: [
      ['Phone', '+1 555 000 0000'],
      ['Email', 'alex@example.com'],
      ['Experience', '6 years'],
      ['Education', "Bachelor's"],
    ],
  },
  sections: [
    {
      kind: 'timeline',
      title: 'Experience',
      items: [
        {
          head: 'Acme Corp',
          sub: 'Senior Backend Engineer',
          date: '2021.07 - Present',
          bullets: ['Led the **order service** rewrite, cutting p99 from 800ms to 220ms'],
        },
      ],
    },
    {
      kind: 'list',
      title: 'Education',
      items: undefined,
      bullets: ['State University - Computer Science'],
    },
  ],
}

test('normalizeLang 只接受已知语言，其余回落 zh', () => {
  assert.equal(normalizeLang('en'), 'en')
  assert.equal(normalizeLang('EN '), 'en')
  assert.equal(normalizeLang('fr'), 'zh')
  assert.equal(normalizeLang(undefined), 'zh')
})

test('产物文件名按语言取后缀', () => {
  assert.equal(resumeFileName('张三', 'zh'), '张三-简历')
  assert.equal(resumeFileName('Alex', 'en'), 'Alex-Resume')
  assert.equal(resumeFileName('Alex'), 'Alex-简历')
})

test('英文骨架的字段与模块名都是英文', () => {
  const sk = buildSkeleton({ lang: 'en', name: 'Alex Chen' })
  assert.equal(sk.meta.lang, 'en')
  assert.deepEqual(
    sk.basics.fields.map(([k]) => k),
    ['Phone', 'Email', 'Experience', 'Education'],
  )
  assert.deepEqual(
    sk.sections.map((s) => s.title),
    ['Experience', 'Skills', 'Projects'],
  )
  assert.equal(sk.basics.name, 'Alex Chen')
})

test('中文骨架保持原样', () => {
  const sk = buildSkeleton({})
  assert.equal(sk.meta.lang, 'zh')
  assert.deepEqual(
    sk.basics.fields.map(([k]) => k),
    LOCALE.zh.fields.map(([k]) => k),
  )
  assert.deepEqual(
    sk.sections.map((s) => s.title),
    ['工作经历', '专业技能', '项目经历'],
  )
})

test('getTemplate 默认 A4，可被 pageSize 覆盖', () => {
  const a4 = getTemplate('classic')
  assert.equal(a4.page.size, 'A4')
  assert.equal(pageWidthMm(a4), 210)
  assert.equal(pageHeightMm(a4), 297)

  const letter = getTemplate('classic', { pageSize: 'Letter' })
  assert.equal(letter.page.size, 'Letter')
  assert.equal(pageWidthMm(letter), PAGE_SIZES.Letter.width)
  assert.equal(pageHeightMm(letter), PAGE_SIZES.Letter.height)

  // 未知值回落 A4，不抛错
  const unknown = getTemplate('classic', { pageSize: 'A3' })
  assert.equal(unknown.page.size, 'A4')
})

test('getTemplate 可覆盖正文字体，且不改动原模板对象', () => {
  const base = getTemplate('minimal')
  const custom = getTemplate('minimal', { font: 'Noto Serif SC' })
  assert.equal(custom.font.body, 'Noto Serif SC')
  assert.equal(base.font.body, 'Microsoft YaHei')
})

test('字体栈包含跨平台回退且去重', () => {
  const stack = fontStack(getTemplate('classic'))
  assert.match(stack, /"Microsoft YaHei"/)
  assert.match(stack, /"PingFang SC"/)
  assert.match(stack, /"Noto Sans CJK SC"/)
  assert.match(stack, /sans-serif$/)
  assert.equal(stack.match(/"Microsoft YaHei"/g).length, 1)
})

test('HTML 按 lang 输出语言、标题与半角冒号', () => {
  const d = normalize(enResume)
  const html = renderHTML(d, getTemplate('classic'))
  assert.match(html, /<html lang="en">/)
  assert.match(html, /<title>Alex Chen - Resume<\/title>/)
  assert.match(html, /Phone: /)
  assert.doesNotMatch(html, /Phone：/)
})

test('HTML 按 pageSize 输出纸张尺寸', () => {
  const d = normalize({ ...enResume, meta: { ...enResume.meta, pageSize: 'Letter' } })
  const t = getTemplate(d.meta.template, { pageSize: d.meta.pageSize })
  const html = renderHTML(d, t)
  assert.match(html, /@page \{ size: Letter/)
  assert.match(html, /width: 215\.9mm/)
  assert.match(html, /min-height: 279\.4mm/)
})

test('DOCX 在 A4 与 Letter 下产出不同字节，且都是合法 zip', async () => {
  const d = normalize(enResume)
  const a4 = await buildDocx(d, getTemplate('classic'))
  const letter = await buildDocx(d, getTemplate('classic', { pageSize: 'Letter' }))
  assert.equal(a4.subarray(0, 2).toString(), 'PK')
  assert.equal(letter.subarray(0, 2).toString(), 'PK')
  assert.ok(!a4.equals(letter), '纸张不同，字节应不同')
})

test('英文简历不再被误报缺少联系方式', () => {
  const d = normalize(enResume)
  const issues = lint(d, {}).issues
  assert.equal(issues.filter((i) => i.rule === 'contact').length, 0)
})

test('英文 Present 被认作合法时间格式', () => {
  const d = normalize(enResume)
  const issues = lint(d, {}).issues
  assert.equal(issues.filter((i) => i.rule === 'date').length, 0)
})

test('英文 Education 模块不会被要求写 bullet', () => {
  const d = normalize({
    ...enResume,
    sections: [
      {
        kind: 'timeline',
        title: 'Education',
        items: [{ head: 'State University', sub: 'BSc', date: '2015 - 2019', bullets: [] }],
      },
    ],
  })
  const empty = lint(d, {}).issues.filter((i) => i.rule === 'empty')
  assert.equal(empty.length, 0)
})

test('英文声称变化但无数字，同样告警', () => {
  const d = normalize({
    ...enResume,
    sections: [
      {
        kind: 'timeline',
        title: 'Experience',
        items: [
          {
            head: 'Acme',
            sub: 'Engineer',
            date: '2021 - Present',
            bullets: ['Improved latency across the platform'],
          },
        ],
      },
    ],
  })
  const hits = lint(d, {}).issues.filter((i) => i.rule === 'numbers')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].level, 'warn')
})

test('英文技能模块不强制数字', () => {
  const d = normalize({
    ...enResume,
    sections: [
      {
        kind: 'list',
        title: 'Skills',
        bullets: ['Improved caching design with Redis'],
      },
    ],
  })
  assert.equal(lint(d, {}).issues.filter((i) => i.rule === 'numbers').length, 0)
})

test('describeSource 认得英文模块名', () => {
  const info = describeSource(
    'Alex alex@example.com\nWork Experience\nProjects\nEducation\nSkills',
  )
  assert.ok(info.detected.includes('工作经历'))
  assert.ok(info.detected.includes('项目经历'))
  assert.ok(info.detected.includes('教育背景'))
  assert.ok(info.detected.includes('专业技能'))
})
