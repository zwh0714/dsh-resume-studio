/**
 * PDF 集成测试：只有探测到转换引擎才真正跑，否则跳过。
 *
 * 这条测试覆盖「DOCX → PDF → 回读页数 → 超页收紧行距」的完整闭环，
 * 是压页逻辑唯一一次端到端验证。没有引擎的机器上跳过，不算失败。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { checkResume, pageCount, renderResume } from '../lib/api.js'
import { converterInfo } from '../lib/convert.js'

const sample = {
  meta: { template: 'classic', maxPages: 2 },
  basics: {
    name: 'PDF测试',
    intent: '求职意向：后端工程师',
    fields: [
      ['电话', '13800000000'],
      ['邮箱', 'pdf@example.com'],
      ['工作年限', '6 年'],
      ['学历', '本科'],
    ],
  },
  sections: [
    {
      kind: 'timeline',
      title: '工作经历',
      items: [
        {
          head: '某某公司',
          sub: '高级工程师',
          date: '2021.07 - 至今',
          bullets: [
            '主导 **订单中心** 重构，接口 P99 从 800ms 降到 220ms，告警下降 **85%**',
            '搭建 **压测体系**，覆盖 12 个核心场景，峰值承载提升 **3 倍**',
          ],
        },
      ],
    },
    { kind: 'list', title: '专业技能', bullets: ['**后端**：Java、Spring Boot、MySQL、Redis'] },
    {
      kind: 'project',
      title: '项目经历',
      items: [
        {
          head: '履约中台',
          sub: '核心开发',
          date: '2023.03 - 2024.02',
          intro: '面向 B 端，日均 **200 万单**。',
          label: '职责与成果：',
          bullets: ['**架构**：事件驱动，链路收敛为 3 个异步阶段'],
        },
      ],
    },
  ],
}

const engine = converterInfo()
const skip = engine.available ? false : `没有可用的转换引擎（${JSON.stringify(engine)}），跳过 PDF 集成测试`

test('端到端出 PDF：页数可回读，且不超过 maxPages', { skip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-pdf-'))
  try {
    const res = await renderResume(sample, {
      outDir: path.join(dir, 'out'),
      formats: ['pdf'],
      maxPages: 2,
    })
    const r = res.results[0]

    assert.ok(fs.existsSync(r.files.pdf), 'PDF 应存在')
    assert.ok(fs.statSync(r.files.pdf).size > 1000, 'PDF 不应是空壳')
    assert.equal(r.engine, engine.kind, '应回报实际使用的引擎')

    const pages = await pageCount(r.files.pdf)
    assert.equal(r.pages, pages, '渲染结果里的页数应与回读一致')
    assert.ok(pages >= 1)
    assert.ok(pages <= 2, `实际 ${pages} 页，超过 maxPages`)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('checkResume 能基于已有 PDF 统计页数', { skip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-pdfcheck-'))
  try {
    const res = await renderResume(sample, { outDir: dir, formats: ['pdf'], maxPages: 2 })
    const pdf = res.results[0].files.pdf

    const { stats } = await checkResume(sample, { pdf, maxPages: 2 })
    assert.ok(stats.pages >= 1)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('maxPages=1 时行距会被收紧（attempts > 1）或页数已达标', { skip }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resume-squeeze-'))
  try {
    const res = await renderResume(sample, { outDir: dir, formats: ['pdf'], maxPages: 1 })
    const r = res.results[0]
    // 要么一次就够，要么尝试过收紧；不应出现 7 次全打满还没收敛
    assert.ok(r.attempts >= 1)
    assert.ok(r.pages <= 1 || r.attempts >= 2, '压页未生效：页数超标却只试了一次')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
