import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  detectConverter,
  converterInfo,
  converterAvailable,
  resetConverterCache,
  convertToPdf,
} from '../lib/convert.js'

const ENV_KEYS = ['DSH_LO_CLI', 'DSH_LO_NODE', 'RESUME_SOFFICE', 'SOFFICE_PATH']

/** 临时改环境并清探测缓存；async 感知，恢复一定发生在 fn 完成之后 */
async function withEnv(patch, fn) {
  const saved = {}
  const savedPath = process.env.PATH
  for (const k of ENV_KEYS) saved[k] = process.env[k]
  try {
    for (const k of ENV_KEYS) delete process.env[k]
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'PATH') continue
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    if (patch.PATH !== undefined) process.env.PATH = patch.PATH
    resetConverterCache()
    return await fn()
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    process.env.PATH = savedPath
    resetConverterCache()
  }
}

const bogus = path.join(os.tmpdir(), 'definitely-not-a-kit-cli.js')

test('两条路都没有时不报「已安装」，而是 available:false', async () => {
  await withEnv({ DSH_LO_CLI: bogus, PATH: '' }, () => {
    assert.equal(detectConverter(), null)
    assert.equal(converterAvailable(), false)
    assert.deepEqual(converterInfo(), { available: false, kind: null })
  })
})

test('RESUME_SOFFICE 指向真实可执行文件时识别为 soffice 引擎', async () => {
  // 用 node 本体冒充 soffice 只验证「探测」，不验证转换
  await withEnv({ DSH_LO_CLI: bogus, RESUME_SOFFICE: process.execPath, PATH: '' }, () => {
    const conv = detectConverter()
    assert.ok(conv, '应探测到系统 LibreOffice')
    assert.equal(conv.kind, 'soffice')
    assert.equal(conv.bin, process.execPath)
    assert.equal(converterInfo().kind, 'soffice')
  })
})

test('SOFFICE_PATH 是 RESUME_SOFFICE 的等价别名', async () => {
  await withEnv({ DSH_LO_CLI: bogus, SOFFICE_PATH: process.execPath, PATH: '' }, () => {
    assert.equal(detectConverter().kind, 'soffice')
  })
})

test('DSH Kit 优先于系统 soffice', async () => {
  await withEnv({ DSH_LO_CLI: process.execPath, RESUME_SOFFICE: process.execPath, PATH: '' }, () => {
    const conv = detectConverter()
    assert.equal(conv.kind, 'kit')
    assert.equal(conv.cli, process.execPath)
  })
})

test('RESUME_SOFFICE 指向不存在的路径时被忽略', async () => {
  await withEnv(
    { DSH_LO_CLI: bogus, RESUME_SOFFICE: path.join(os.tmpdir(), 'nope-soffice'), PATH: '' },
    () => {
      assert.equal(detectConverter(), null)
    },
  )
})

test('找不到引擎时 convertToPdf 给出含两条出路的可执行报错', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-eng-'))
  const docx = path.join(dir, 'a.docx')
  fs.writeFileSync(docx, 'PK')

  await withEnv({ DSH_LO_CLI: bogus, PATH: '' }, async () => {
    await assert.rejects(
      () => convertToPdf(docx, path.join(dir, 'a.pdf')),
      (err) => {
        assert.match(err.message, /找不到可用的转换引擎/)
        assert.match(err.message, /LibreOffice/)
        assert.match(err.message, /DSH_LO_CLI/)
        assert.match(err.message, /html,docx/)
        return true
      },
    )
  })
})
