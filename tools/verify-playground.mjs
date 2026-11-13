/**
 * 校验 docs/index.html 里内联的浏览器包，与 lib/ 下的真实渲染器输出逐字节一致。
 *
 * 覆盖：2 份示例 × 3 版式 × 2 纸张 × 3 组主题（含一组非法值，验证清洗逻辑）。
 * 任何一次改动渲染层后跑 `node tools/verify-playground.mjs` 都能立刻发现漂移。
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const html = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8')
const start = html.indexOf('// ===== theme.js =====')
const end = html.indexOf('// ============================================================================\n// 页面逻辑')
if (start === -1 || end === -1) {
  console.error('FAIL: 找不到内联 bundle 的边界标记')
  process.exit(1)
}
const bundle = html.slice(start, end)

const sandbox = {}
vm.createContext(sandbox)
vm.runInContext(
  bundle + '\n;globalThis.__x = { renderHTML, lint, normalize, getTemplate };',
  sandbox,
)
const { renderHTML, lint, normalize, getTemplate } = sandbox.__x

const realModel = await import('../lib/model.js')
const realTpl = await import('../lib/templates.js')
const realLint = await import('../lib/lint.js')
const realHtml = await import('../lib/render-html.js')

const THEMES = [
  ['默认主题', undefined],
  ['墨青 · 大字号 · 竖线', { accent: '#0F766E', bodySize: 11, sectionStyle: 'bar', lineHeight: 1.02 }],
  ['非法值兜底', { accent: 'zzz', bodySize: 999, lineHeight: 99, sectionStyle: 'nope' }],
]
const PAGE_SIZES = ['A4', 'Letter']
const TEMPLATES = ['classic', 'minimal', 'sidebar']
const FILES = ['zh-backend.json', 'en-frontend.json']

let checks = 0
let failures = 0

function check(label, a, b) {
  checks++
  const same = typeof a === 'string' ? a === b : JSON.stringify(a) === JSON.stringify(b)
  if (!same) {
    failures++
    console.log(`  MISMATCH ${label}`)
  }
}

for (const file of FILES) {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'examples', file), 'utf8'))
  for (const id of TEMPLATES) {
    for (const pageSize of PAGE_SIZES) {
      for (const [themeLabel, theme] of THEMES) {
        const meta = { ...raw.meta, template: id, pageSize, theme }

        const dA = normalize({ ...raw, meta })
        const dB = realModel.normalize({ ...raw, meta })

        // 主题在两边都取 normalize 之后的结果，确保比的是同一份清洗输出
        const optA = { pageSize, theme: dA.meta.theme }
        const optB = { pageSize, theme: dB.meta.theme }

        const label = `${file} ${id}/${pageSize}/${themeLabel}`
        check(`${label} render`, renderHTML(dA, getTemplate(id, optA)), realHtml.renderHTML(dB, realTpl.getTemplate(id, optB)))
        check(`${label} lint`, lint(dB, { pages: null, maxPages: meta.maxPages || 0 }), realLint.lint(dB, { pages: null, maxPages: meta.maxPages || 0 }))
        check(`${label} theme`, dA.meta.theme, dB.meta.theme)
      }
    }
  }
}

console.log(
  failures === 0
    ? `PASS: 浏览器包与 Node 渲染器完全一致（${checks} 项）`
    : `FAIL: ${failures}/${checks} 项不一致`,
)
process.exit(failures === 0 ? 0 : 1)
