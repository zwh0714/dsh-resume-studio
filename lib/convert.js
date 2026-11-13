/**
 * 文档转换引擎：DOCX → PDF、DOC/DOCX/ODT → 纯文本。
 *
 * 两个来源，按优先级：
 *   1. DSH 自带的 LibreOffice Kit（与 office-export-pdf 同一个引擎）——
 *      分页与 Word 最一致，优先使用
 *   2. 系统安装的 LibreOffice（soffice）—— 让插件在「没装 DSH」的机器上也能出 PDF
 *
 * 两者都找不到时不抛错到崩溃，由调用方降级（只出 HTML + DOCX）。
 * 这两种情况必须分开处理：Kit 用 `convert --input --output`，
 * 系统 LibreOffice 用 `--headless --convert-to`，参数语义完全不同。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let cached
let probed = false

const unique = (list) => [...new Set(list.filter(Boolean))]

// ---------------------------------------------------------------- Kit ----

function kitRelPath() {
  return path.join('app.asar.unpacked', 'dsh', 'node_modules', '@deepseek-ai', 'libreoffice-kit', 'lib', 'cli.js')
}

function kitCandidates() {
  const rel = kitRelPath()
  const home = os.homedir()
  const list = [process.env.DSH_LO_CLI]

  if (process.resourcesPath) list.push(path.join(process.resourcesPath, rel))

  const exeDir = path.dirname(process.execPath || '')
  list.push(path.join(exeDir, 'resources', rel))
  list.push(path.join(exeDir, '..', 'resources', rel))

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    list.push(path.join(local, 'Programs', 'DeepSeek Harness', 'resources', rel))
    list.push(path.join('C:', 'Program Files', 'DeepSeek Harness', 'resources', rel))
  } else if (process.platform === 'darwin') {
    list.push(path.join('/Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', rel))
    list.push(path.join(home, 'Applications', 'DeepSeek Harness.app', 'Contents', 'Resources', rel))
  } else {
    list.push(path.join('/opt', 'DeepSeek Harness', 'resources', rel))
    list.push(path.join(home, '.local', 'share', 'deepseek-harness', 'resources', rel))
  }
  return unique(list)
}

function nodeCandidates() {
  const list = [process.env.DSH_LO_NODE]
  const exe = process.execPath || ''
  if (/node(\.exe)?$/i.test(path.basename(exe))) list.push(exe)

  if (process.resourcesPath) {
    const base = path.join(process.resourcesPath, 'runtime', 'primary-runtime', 'dependencies', 'node', 'bin')
    list.push(path.join(base, process.platform === 'win32' ? 'node.exe' : 'node'))
  }
  list.push('node')
  return unique(list)
}

function findKit() {
  const cli = kitCandidates().find((p) => p && existsSync(p))
  if (!cli) return null
  const node = nodeCandidates().find((p) => p === 'node' || existsSync(p)) || 'node'
  return { kind: 'kit', node, cli }
}

// ------------------------------------------------------- 系统 soffice ----

function sofficeCandidates() {
  const home = os.homedir()
  const list = [process.env.RESUME_SOFFICE, process.env.SOFFICE_PATH]

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
    for (const base of [
      'C:\\Program Files\\LibreOffice',
      'C:\\Program Files (x86)\\LibreOffice',
      path.join(local, 'Programs', 'LibreOffice'),
    ]) {
      list.push(path.join(base, 'program', 'soffice.exe'))
    }
  } else if (process.platform === 'darwin') {
    list.push('/Applications/LibreOffice.app/Contents/MacOS/soffice')
    list.push(path.join(home, 'Applications', 'LibreOffice.app', 'Contents', 'MacOS', 'soffice'))
  } else {
    for (const p of [
      '/usr/bin/soffice',
      '/usr/local/bin/soffice',
      '/snap/bin/libreoffice',
      '/usr/lib/libreoffice/program/soffice',
      '/opt/libreoffice/program/soffice',
    ]) {
      list.push(p)
    }
  }

  // 再翻一遍 PATH，覆盖自定义安装（不 spawn，避免拖慢启动）
  const names = process.platform === 'win32' ? ['soffice.exe'] : ['soffice']
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue
    for (const n of names) list.push(path.join(dir, n))
  }

  return unique(list)
}

function isFile(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function findSystemOffice() {
  const bin = sofficeCandidates().find((p) => p && isFile(p))
  return bin ? { kind: 'soffice', bin } : null
}

// -------------------------------------------------------------- 探测 ----

/**
 * @returns {{kind:'kit',node:string,cli:string} | {kind:'soffice',bin:string} | null}
 */
export function detectConverter() {
  if (probed) return cached
  probed = true
  cached = findKit() || findSystemOffice()
  return cached
}

/** 清缓存（换环境或测试时用） */
export function resetConverterCache() {
  probed = false
  cached = undefined
}

export function converterInfo() {
  const c = detectConverter()
  if (!c) return { available: false, kind: null }
  return c.kind === 'kit'
    ? { available: true, kind: 'kit', node: c.node, cli: c.cli }
    : { available: true, kind: 'soffice', bin: c.bin }
}

export function converterAvailable() {
  return detectConverter() !== null
}

// ------------------------------------------------------------ 执行 ----

function run(cmd, args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
      reject(new Error(`转换超时（>${timeoutMs}ms）：${cmd}`))
    }, timeoutMs)

    child.stdout.on('data', (d) => (out += d.toString()))
    child.stderr.on('data', (d) => (err += d.toString()))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, out, err })
    })
  })
}

/** 系统 LibreOffice 每次都用一个独立 profile，避免和用户已开的实例抢锁 */
function sofficeArgs(convertTo, outDir, input) {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'resume-lo-profile-'))
  return {
    args: [
      `-env:UserInstallation=${pathToFileURL(profile).href}`,
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nodefault',
      '--nofirststartwizard',
      '--convert-to',
      convertTo,
      '--outdir',
      outDir,
      input,
    ],
    cleanup: () => rmSync(profile, { recursive: true, force: true }),
  }
}

function pickProduced(dir, base, ext) {
  const want = `${base}${ext}`
  const hit = path.join(dir, want)
  if (existsSync(hit)) return hit
  // 有的是大小写差异，或同一目录下有多个产物
  const found = readdirSync(dir).find((f) => f.toLowerCase() === want.toLowerCase())
  return found ? path.join(dir, found) : null
}

/**
 * DOCX → PDF。
 * @returns {Promise<{ pdfPath: string, missingFonts: string[], engine: string }>}
 */
export async function convertToPdf(docxPath, pdfPath) {
  const conv = detectConverter()
  if (!conv) {
    throw new Error(
      '找不到可用的转换引擎，无法生成 PDF。二选一：\n' +
        '  · 安装 LibreOffice（本插件会自动发现 soffice）\n' +
        '  · 设置 DSH_LO_CLI / DSH_LO_NODE 指向 DSH 的 LibreOffice Kit\n' +
        '也可以改用 formats="html,docx"，再用浏览器打印成 PDF（HTML 已内置打印样式）。',
    )
  }

  if (existsSync(pdfPath)) rmSync(pdfPath, { force: true })

  if (conv.kind === 'kit') {
    const { code, out, err } = await run(conv.node, [
      conv.cli,
      'convert',
      '--input',
      docxPath,
      '--output',
      pdfPath,
    ])
    if (code !== 0 || !existsSync(pdfPath)) {
      throw new Error(`PDF 转换失败（Kit，exit ${code}）：${(err || out).trim().slice(0, 500)}`)
    }
    let meta = {}
    try {
      meta = JSON.parse(out.trim().split('\n').filter(Boolean).pop() || '{}')
    } catch {
      meta = {}
    }
    return { pdfPath: path.resolve(pdfPath), missingFonts: meta.missingFonts || [], engine: 'kit' }
  }

  // 系统 LibreOffice
  const outDir = mkdtempSync(path.join(os.tmpdir(), 'resume-soffice-pdf-'))
  const base = path.parse(docxPath).name
  const { args, cleanup } = sofficeArgs('pdf', outDir, docxPath)
  try {
    const { code, out, err } = await run(conv.bin, args)
    const produced = pickProduced(outDir, base, '.pdf')
    if (code !== 0 || !produced) {
      throw new Error(`PDF 转换失败（soffice，exit ${code}）：${(err || out).trim().slice(0, 500)}`)
    }
    renameSync(produced, pdfPath)
    return { pdfPath: path.resolve(pdfPath), missingFonts: [], engine: 'soffice' }
  } finally {
    cleanup()
    rmSync(outDir, { recursive: true, force: true })
  }
}

/**
 * DOC / DOCX / ODT → 纯文本。
 * @returns {Promise<{ text: string, engine: string }>}
 */
export async function convertDocumentToText(inputPath, outputPath) {
  const conv = detectConverter()
  if (!conv) {
    throw new Error(
      '找不到可用的转换引擎，无法读取老格式。安装 LibreOffice（会自动发现），' +
        '或设置 DSH_LO_CLI / DSH_LO_NODE 指向 DSH 的 LibreOffice Kit。',
    )
  }

  const outDir = mkdtempSync(path.join(os.tmpdir(), 'resume-text-'))
  const base = path.parse(inputPath).name

  try {
    if (conv.kind === 'kit') {
      const { code, out, err } = await run(conv.node, [
        conv.cli,
        'convert',
        '--input',
        inputPath,
        '--output',
        outputPath,
      ])
      if (code !== 0 || !existsSync(outputPath)) {
        throw new Error(`转换失败（Kit，exit ${code}）：${(err || out).trim().slice(0, 500)}`)
      }
      return { text: '', engine: 'kit' }
    }

    // 系统 LibreOffice：优先带编码声明的文本过滤器，失败再退回纯 txt
    for (const filter of ['txt:Text (encoded):UTF8', 'txt']) {
      const { args, cleanup } = sofficeArgs(filter, outDir, inputPath)
      try {
        const { code, out, err } = await run(conv.bin, args)
        const produced = pickProduced(outDir, base, '.txt')
        if (code === 0 && produced) {
          renameSync(produced, outputPath)
          return { text: '', engine: 'soffice' }
        }
        if (filter === 'txt') {
          throw new Error(`转换失败（soffice，exit ${code}）：${(err || out).trim().slice(0, 500)}`)
        }
      } finally {
        cleanup()
      }
    }
    throw new Error('转换失败（soffice）：没有产出 .txt')
  } finally {
    rmSync(outDir, { recursive: true, force: true })
  }
}
