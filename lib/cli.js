#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

import { checkResume, listTemplates, loadData, renderResume } from './api.js'
import { convertToText, describeSource } from './import.js'
import { RULES } from './lint.js'
import { LANGUAGES } from './locale.js'
import { buildSkeleton } from './skeleton.js'
import { converterInfo } from './convert.js'
import { PAGE_SIZES } from './templates.js'

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else out[key] = true
    } else out._.push(a)
  }
  return out
}

function init(args) {
  const file = path.resolve(args.out || 'resume.json')
  if (fs.existsSync(file)) throw new Error(`已存在：${file}`)
  const skeleton = buildSkeleton({ name: args.name, intent: args.intent, lang: args.lang })
  if (args['page-size']) skeleton.meta.pageSize = String(args['page-size'])
  fs.writeFileSync(file, JSON.stringify(skeleton, null, 2), 'utf8')
  return { created: file, lang: skeleton.meta.lang, pageSize: skeleton.meta.pageSize || 'A4' }
}

const HELP = `dsh-resume — 简历渲染器（HTML / DOCX / PDF）

  node lib/cli.js render --in resume.json --out out [--templates classic,minimal,sidebar]
                         [--formats html,docx,pdf] [--max-pages 3]
  node lib/cli.js check  --in resume.json [--pdf out/x.pdf] [--max-pages 3]
  node lib/cli.js templates
  node lib/cli.js init   [--out resume.json] [--lang zh|en] [--page-size A4|Letter]
  node lib/cli.js import --in old.doc [--out old.txt]
  node lib/cli.js engine

语言：${LANGUAGES.join(' / ')}（默认 zh）
页面：${Object.keys(PAGE_SIZES).join(' / ')}（默认 A4）
`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0]
  let result

  if (cmd === 'render') {
    if (!args.in) throw new Error('缺少 --in <data.json>')
    result = await renderResume(loadData(args.in), {
      outDir: args.out || 'out',
      templates: args.templates ? String(args.templates).split(',').map((s) => s.trim()) : undefined,
      formats: args.formats ? String(args.formats).split(',').map((s) => s.trim()) : undefined,
      maxPages: args['max-pages'],
    })
  } else if (cmd === 'check') {
    if (!args.in) throw new Error('缺少 --in <data.json>')
    result = { ...(await checkResume(loadData(args.in), { pdf: args.pdf, maxPages: args['max-pages'] })), rules: RULES }
  } else if (cmd === 'templates') {
    result = { templates: listTemplates() }
  } else if (cmd === 'import') {
    if (!args.in) throw new Error('缺少 --in <old.doc|old.docx|old.odt>')
    const text = await convertToText(args.in)
    if (args.out) fs.writeFileSync(path.resolve(args.out), text, 'utf8')
    result = { inputPath: args.in, savedTo: args.out ? path.resolve(args.out) : undefined, ...describeSource(text), text }
  } else if (cmd === 'init') {
    result = init(args)
  } else if (cmd === 'engine') {
    result = converterInfo()
  } else {
    process.stdout.write(HELP)
    return
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

main().catch((e) => {
  process.stderr.write(`错误：${e.message}\n`)
  process.exit(1)
})
